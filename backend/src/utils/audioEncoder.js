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

/**
 * Validates an MP3 buffer by checking its MPEG frame sync word and header fields.
 *
 * @param {Buffer} buffer - Raw MP3 buffer.
 * @returns {{ mpegVersion: string, layer: number, sampleRate: number, numChannels: number, bitrateIndex: number }}
 * @throws {Error} If the buffer is corrupted, lacks a valid sync word, or has unsupported frame properties.
 */
function validateMp3(buffer) {
  if (!buffer || buffer.length < 4) {
    throw new Error('Invalid MP3 audio: buffer is too short to contain an MPEG frame header.');
  }

  // Skip ID3v2 tag if present (starts with 'ID3')
  let offset = 0;
  if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'ID3') {
    const tagSize =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    offset = 10 + tagSize;
  }

  // Scan for the first 11-bit sync word (0xFFE)
  let found = false;
  let header = 0;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] === 0xff && (buffer[offset + 1] & 0xe0) === 0xe0) {
      header = buffer.readUInt32BE(offset);
      found = true;
      break;
    }
    offset++;
  }

  if (!found) {
    throw new Error('Invalid MP3 audio: missing MPEG frame sync word (0xFFE0).');
  }

  const versionBits = (header >> 19) & 0x03;
  const layerBits = (header >> 17) & 0x03;
  const bitrateIndex = (header >> 12) & 0x0f;
  const sampleRateIndex = (header >> 10) & 0x03;
  const channelMode = (header >> 6) & 0x03;

  if (versionBits === 0x01) {
    throw new Error('Corrupted MP3 header: reserved MPEG version.');
  }
  if (layerBits !== 0x01) {
    throw new Error(`Unsupported MPEG audio layer (${layerBits}): expected Layer III (MP3).`);
  }
  if (bitrateIndex === 0x00 || bitrateIndex === 0x0f) {
    throw new Error(`Invalid MP3 bitrate index (${bitrateIndex}).`);
  }
  if (sampleRateIndex === 0x03) {
    throw new Error('Corrupted MP3 header: reserved sample rate index.');
  }

  const isMpeg1 = versionBits === 0x03;
  const isMpeg2 = versionBits === 0x02;
  const isMpeg25 = versionBits === 0x00;

  let sampleRate = 0;
  if (isMpeg1) {
    const rates = [44100, 48000, 32000];
    sampleRate = rates[sampleRateIndex];
  } else if (isMpeg2) {
    const rates = [22050, 24000, 16000];
    sampleRate = rates[sampleRateIndex];
  } else if (isMpeg25) {
    const rates = [11025, 12000, 8000];
    sampleRate = rates[sampleRateIndex];
  }

  const numChannels = channelMode === 0x03 ? 1 : 2;

  return {
    mpegVersion: isMpeg1 ? 'MPEG-1' : isMpeg2 ? 'MPEG-2' : 'MPEG-2.5',
    layer: 3,
    sampleRate,
    numChannels,
    bitrateIndex,
  };
}

/**
 * Inspects an incoming audio buffer for ASR processing, validating container integrity.
 * Reuses parseWav and validateMp3; throws on unexpected or corrupt formats.
 *
 * @param {Buffer} buffer - Raw audio bytes.
 * @param {string} [declaredMimeType] - Declared MIME type from client.
 * @returns {{ format: 'mp3'|'wav', mimeType: string, sampleRate: number, numChannels: number }}
 * @throws {Error} If the buffer is not a valid MP3 or WAV container.
 */
function inspectAudioPayload(buffer, declaredMimeType = '') {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty audio payload provided.');
  }

  // Check WAV RIFF signature
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'RIFF') {
    const { fmt } = parseWav(buffer);
    return {
      format: 'wav',
      mimeType: 'audio/wav',
      sampleRate: fmt.sampleRate,
      numChannels: fmt.numChannels,
    };
  }

  // Check WebM signature [0x1A, 0x45, 0xDF, 0xA3]
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    throw new Error(
      'WebM container format is not supported by the speech recognition engine. Upload audio as 16kHz mono audio/mp3 or audio/wav.'
    );
  }

  // Check OGG signature [0x4F, 0x67, 0x67, 0x53]
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') {
    throw new Error(
      'Ogg container format is not supported for voice queries. Upload audio as 16kHz mono audio/mp3 or audio/wav.'
    );
  }

  // Validate MP3
  const mp3Info = validateMp3(buffer);
  return {
    format: 'mp3',
    mimeType: 'audio/mp3',
    sampleRate: mp3Info.sampleRate,
    numChannels: mp3Info.numChannels,
  };
}

module.exports = {
  parseWav,
  wavToInt16Array,
  encodeWavToMp3,
  validateMp3,
  inspectAudioPayload,
};
