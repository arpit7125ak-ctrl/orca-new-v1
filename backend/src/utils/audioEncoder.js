/**
 * @fileoverview Pure-JS Audio Transcoder & Encoder
 * @module utils/audioEncoder
 * @description
 * Converts uncompressed audio buffers (such as 32-bit float or 16-bit PCM WAV)
 * into compact, high-efficiency MP3 buffers for marine low-bandwidth transmission.
 *
 * Architecture Principles:
 * - Dynamic RIFF Parsing: Never hardcodes sample rates, channels, or bit depths.
 *   Extracts metadata directly from the RIFF header and drives the encoder strictly
 *   from verified stream properties.
 * - Anti-Fabrication & Strict Validation: Throws immediately on unrecognized chunk
 *   formats or invalid bit depths rather than emitting corrupted or pitch-shifted audio.
 * - Pure-JS Execution: Powered by `@breezystack/lamejs` to ensure zero native C/C++
 *   compilation and zero external OS package dependencies on Docker or Render.
 */

/**
 * Parses a WAV buffer's RIFF chunks and extracts format metadata and audio data offset.
 *
 * @param {Buffer} buffer - Raw WAV file buffer.
 * @returns {{ fmt: { audioFormat: number, numChannels: number, sampleRate: number, byteRate: number, blockAlign: number, bitsPerSample: number }, dataOffset: number, dataSize: number }}
 * @throws {Error} If the buffer is not a valid RIFF/WAVE stream or missing required chunks.
 */
function parseWav(buffer) {
  if (!buffer || buffer.length < 44) {
    throw new Error('Invalid WAV buffer: buffer is smaller than minimum 44-byte RIFF header.');
  }

  const riff = buffer.toString('ascii', 0, 4);
  const wave = buffer.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error(`Invalid WAV header: expected "RIFF"/"WAVE", received "${riff}"/"${wave}".`);
  }

  let offset = 12;
  let fmt = null;
  let dataOffset = null;
  let dataSize = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;

    if (chunkId === 'fmt ') {
      if (chunkSize < 16) {
        throw new Error(`Corrupted WAV: "fmt " chunk size (${chunkSize}) is under 16 bytes.`);
      }
      fmt = {
        audioFormat: buffer.readUInt16LE(chunkDataOffset),
        numChannels: buffer.readUInt16LE(chunkDataOffset + 2),
        sampleRate: buffer.readUInt32LE(chunkDataOffset + 4),
        byteRate: buffer.readUInt32LE(chunkDataOffset + 8),
        blockAlign: buffer.readUInt16LE(chunkDataOffset + 12),
        bitsPerSample: buffer.readUInt16LE(chunkDataOffset + 14),
      };
    } else if (chunkId === 'data') {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
      break;
    }

    offset = chunkDataOffset + chunkSize;
  }

  if (!fmt) {
    throw new Error('Invalid WAV: missing required "fmt " subchunk.');
  }
  if (dataOffset === null) {
    throw new Error('Invalid WAV: missing required "data" subchunk.');
  }

  return { fmt, dataOffset, dataSize };
}

/**
 * Converts a WAV buffer (supporting IEEE float32 or PCM int16) into an Int16Array.
 *
 * @param {Buffer} wavBuffer
 * @param {object} fmt
 * @param {number} dataOffset
 * @param {number} dataSize
 * @returns {Int16Array}
 */
function wavToInt16Array(wavBuffer, fmt, dataOffset, dataSize) {
  if (fmt.audioFormat === 3 && fmt.bitsPerSample === 32) {
    // 32-bit IEEE float little-endian (Bhashini default)
    const numSamples = Math.min(
      Math.floor(dataSize / 4),
      Math.floor((wavBuffer.length - dataOffset) / 4)
    );
    const int16Samples = new Int16Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const floatVal = wavBuffer.readFloatLE(dataOffset + i * 4);
      // Clamp strictly to [-1.0, 1.0] to prevent overflow wraps
      const clamped = Math.max(-1.0, Math.min(1.0, floatVal));
      int16Samples[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
    }
    return int16Samples;
  }

  if (fmt.audioFormat === 1 && fmt.bitsPerSample === 16) {
    // Standard 16-bit signed integer PCM
    const numSamples = Math.min(
      Math.floor(dataSize / 2),
      Math.floor((wavBuffer.length - dataOffset) / 2)
    );
    const int16Samples = new Int16Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      int16Samples[i] = wavBuffer.readInt16LE(dataOffset + i * 2);
    }
    return int16Samples;
  }

  throw new Error(
    `Unsupported WAV encoding: audioFormat=${fmt.audioFormat}, bitsPerSample=${fmt.bitsPerSample}. Expected 32-bit float (format 3) or 16-bit PCM (format 1).`
  );
}

/** Cache reference for dynamic lamejs import */
let Mp3EncoderClass = null;

/**
 * Encodes a WAV buffer into a compressed MP3 buffer using dynamic properties from the RIFF header.
 *
 * @param {Buffer} wavBuffer - Raw WAV file buffer.
 * @param {number} [targetKbps=32] - Target CBR bitrate (default: 32 kbps for marine voice clarity).
 * @returns {Promise<{ mp3Buffer: Buffer, durationSec: number, sampleRate: number, numChannels: number, sizeBytes: number }>}
 */
async function encodeWavToMp3(wavBuffer, targetKbps = 32) {
  const { fmt, dataOffset, dataSize } = parseWav(wavBuffer);

  // Validate channels
  if (fmt.numChannels !== 1) {
    throw new Error(`Unsupported WAV channels: expected 1 (mono), received ${fmt.numChannels}.`);
  }

  // Validate sample rate range
  if (fmt.sampleRate < 8000 || fmt.sampleRate > 48000) {
    throw new Error(`Unsupported WAV sample rate: ${fmt.sampleRate} Hz.`);
  }

  const int16Samples = wavToInt16Array(wavBuffer, fmt, dataOffset, dataSize);

  if (!Mp3EncoderClass) {
    const lameModule = await import('@breezystack/lamejs');
    Mp3EncoderClass = lameModule.Mp3Encoder || lameModule.default?.Mp3Encoder;
    if (!Mp3EncoderClass) {
      throw new Error('Failed to resolve Mp3Encoder constructor from @breezystack/lamejs.');
    }
  }

  // Drive the encoder strictly from the WAV header's actual sampleRate and channels
  const encoder = new Mp3EncoderClass(fmt.numChannels, fmt.sampleRate, targetKbps);
  const chunks = [];

  const sampleBlockSize = 1152;
  for (let i = 0; i < int16Samples.length; i += sampleBlockSize) {
    const chunk = int16Samples.subarray(i, i + sampleBlockSize);
    const mp3chunk = encoder.encodeBuffer(chunk);
    if (mp3chunk && mp3chunk.length > 0) {
      chunks.push(Buffer.from(mp3chunk));
    }
  }

  const flushChunk = encoder.flush();
  if (flushChunk && flushChunk.length > 0) {
    chunks.push(Buffer.from(flushChunk));
  }

  const mp3Buffer = Buffer.concat(chunks);
  const durationSec = Number((int16Samples.length / fmt.sampleRate).toFixed(3));

  return {
    mp3Buffer,
    durationSec,
    sampleRate: fmt.sampleRate,
    numChannels: fmt.numChannels,
    sizeBytes: mp3Buffer.length,
  };
}

module.exports = {
  parseWav,
  wavToInt16Array,
  encodeWavToMp3,
};
