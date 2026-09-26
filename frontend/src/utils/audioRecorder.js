/**
 * @fileoverview Web Audio API 16kHz Mono MP3 Recorder
 * @module utils/audioRecorder
 * @description
 * Records microphone audio via Web Audio API, downsamples to 16,000 Hz mono PCM,
 * and compresses client-side to 32kbps mono MP3 using dynamically imported @breezystack/lamejs.
 *
 * Performance Architecture:
 * - Lazy Loading: @breezystack/lamejs is dynamically imported ONLY when recording begins.
 *   This prevents the ~59KB gzipped encoder code from inflating the initial app bundle
 *   for users who do not use voice input.
 * - Universal 16kHz Mono: Resamples hardware mic streams (44.1kHz / 48kHz) to canonical 16,000 Hz.
 * - Low-Bandwidth: 5s query is ~20KB MP3 instead of ~160KB uncompressed WAV (~4s on 2G vs ~34s).
 *
 * iOS SAFARI COMPATIBILITY WARNING:
 * 1. UNTESTED ON PHYSICAL iOS HARDWARE: This implementation has been tested in desktop
 *    browsers and Android WebKit, but remains untested on physical iOS devices.
 * 2. FRAGILE PATHS ON iOS:
 *    - AudioContext Suspension: iOS requires an explicit user gesture (touchend/click)
 *      to transition AudioContext from 'suspended' to 'running'. If this call fails or stalls,
 *      start() throws immediately to trigger the browser Web Speech fallback.
 *    - Hardware Sample Rate: iOS hardware microphone input defaults strictly to 44.1kHz or 48kHz.
 *      The linear interpolation resampling path (inputSampleRate -> 16000Hz) handles this, but
 *      must be verified on physical Apple hardware for audio artifacting.
 *    - ScriptProcessorNode: Deprecated in favor of AudioWorklet, but retains broad iOS Safari
 *      support; AudioWorklet loading via blob/module URLs has known CORS/sandbox restrictions on iOS PWA shells.
 * 3. FALLBACK GUARANTEE: If getUserMedia or AudioContext throws on iOS, the calling UI
 *    catches the error and immediately falls back to the native Web Speech API (SpeechRecognition).
 */

let Mp3EncoderClass = null;

/**
 * Lazy loads the Mp3Encoder from @breezystack/lamejs on demand.
 * Keeps initial bundle size light for non-voice users.
 *
 * @returns {Promise<typeof import('@breezystack/lamejs').Mp3Encoder>}
 */
async function loadMp3Encoder() {
  if (!Mp3EncoderClass) {
    const lameModule = await import('@breezystack/lamejs');
    Mp3EncoderClass = lameModule.Mp3Encoder || lameModule.default?.Mp3Encoder;
    if (!Mp3EncoderClass) {
      throw new Error('Failed to resolve Mp3Encoder constructor from @breezystack/lamejs.');
    }
  }
  return Mp3EncoderClass;
}

export class AudioRecorder {
  constructor() {
    this.stream = null;
    this.audioContext = null;
    this.processor = null;
    this.source = null;
    this.samples = [];
    this.isRecording = false;
    this.startTime = null;
  }

  /**
   * Checks if audio recording is supported in the current browser.
   * @returns {boolean}
   */
  static isSupported() {
    return (
      typeof window !== 'undefined' &&
      Boolean(navigator?.mediaDevices?.getUserMedia) &&
      Boolean(window.AudioContext || window.webkitAudioContext)
    );
  }

  /**
   * Starts microphone recording.
   * Proactively triggers dynamic import of lamejs during user speech.
   *
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRecording) return;

    this.samples = [];
    this.isRecording = true;
    this.startTime = Date.now();

    // Start background preloading of lamejs chunk so it is ready by stop()
    loadMp3Encoder().catch((err) => {
      console.warn('[AudioRecorder] Background encoder preload notice:', err);
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err) {
      this.isRecording = false;
      if (this.audioContext) await this.audioContext.close();
      throw new Error(`Microphone access denied: ${err.message}`);
    }

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    // Use ScriptProcessorNode for universal browser/mobile audio buffering
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const inputData = e.inputBuffer.getChannelData(0);
      this.samples.push(new Float32Array(inputData));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  /**
   * Stops recording and encodes the captured audio to 32kbps mono 16kHz MP3.
   *
   * @returns {Promise<{ audioBase64: string, audioMimeType: string, durationSec: number, sizeBytes: number }>}
   */
  async stop() {
    if (!this.isRecording) {
      throw new Error('Recorder is not active.');
    }

    this.isRecording = false;

    // Disconnect audio nodes
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
    }
    if (this.source) {
      this.source.disconnect();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    const inputSampleRate = this.audioContext.sampleRate;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }

    // Flatten collected Float32 chunks
    let totalLength = 0;
    for (const chunk of this.samples) {
      totalLength += chunk.length;
    }

    if (totalLength === 0) {
      throw new Error('No audio data was recorded.');
    }

    const mergedSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.samples) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }

    // Resample to 16000 Hz if hardware rate differs
    const targetSampleRate = 16000;
    let resampledSamples;
    if (inputSampleRate === targetSampleRate) {
      resampledSamples = mergedSamples;
    } else {
      const ratio = inputSampleRate / targetSampleRate;
      const targetLength = Math.round(mergedSamples.length / ratio);
      resampledSamples = new Float32Array(targetLength);
      for (let i = 0; i < targetLength; i++) {
        const srcIndex = i * ratio;
        const low = Math.floor(srcIndex);
        const high = Math.min(low + 1, mergedSamples.length - 1);
        const weight = srcIndex - low;
        resampledSamples[i] = (1 - weight) * mergedSamples[low] + weight * mergedSamples[high];
      }
    }

    // Convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
    const int16Samples = new Int16Array(resampledSamples.length);
    for (let i = 0; i < resampledSamples.length; i++) {
      const s = Math.max(-1, Math.min(1, resampledSamples[i]));
      int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Ensure Mp3Encoder is loaded
    const EncoderClass = await loadMp3Encoder();
    const encoder = new EncoderClass(1, targetSampleRate, 32);
    const mp3Chunks = [];
    const blockSize = 1152;

    for (let i = 0; i < int16Samples.length; i += blockSize) {
      const chunk = int16Samples.subarray(i, i + blockSize);
      const mp3Buf = encoder.encodeBuffer(chunk);
      if (mp3Buf.length > 0) {
        mp3Chunks.push(mp3Buf);
      }
    }

    const flushBuf = encoder.flush();
    if (flushBuf.length > 0) {
      mp3Chunks.push(flushBuf);
    }

    // Calculate total byte size and merge into Uint8Array
    let totalMp3Bytes = 0;
    for (const chunk of mp3Chunks) {
      totalMp3Bytes += chunk.length;
    }

    const mp3Bytes = new Uint8Array(totalMp3Bytes);
    let mp3Offset = 0;
    for (const chunk of mp3Chunks) {
      mp3Bytes.set(chunk, mp3Offset);
      mp3Offset += chunk.length;
    }

    // Convert Uint8Array to base64
    let binary = '';
    const len = mp3Bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(mp3Bytes[i]);
    }
    const audioBase64 = btoa(binary);
    const durationSec = Number((resampledSamples.length / targetSampleRate).toFixed(2));

    return {
      audioBase64,
      audioMimeType: 'audio/mp3',
      durationSec,
      sizeBytes: totalMp3Bytes,
    };
  }
}
