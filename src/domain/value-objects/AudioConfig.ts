export interface IAudioConfig {
  sampleRate: number; // e.g., 48000
  channels: number; // e.g., 1 (mono)
  bitDepth: number; // e.g., 16
  format: "pcm16"; // Only PCM16 supported for now
}

export class AudioConfig {
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitDepth: number;
  readonly format: "pcm16";

  constructor(config: IAudioConfig) {
    // Validate audio config
    if (config.sampleRate !== 48000) {
      throw new Error("Only 48kHz sample rate is supported");
    }
    if (config.channels !== 1) {
      throw new Error("Only mono (1 channel) is supported");
    }
    if (config.bitDepth !== 16) {
      throw new Error("Only 16-bit PCM is supported");
    }
    if (config.format !== "pcm16") {
      throw new Error("Only PCM16 format is supported");
    }

    this.sampleRate = config.sampleRate;
    this.channels = config.channels;
    this.bitDepth = config.bitDepth;
    this.format = config.format;
  }

  static default(): AudioConfig {
    return new AudioConfig({
      sampleRate: 48000,
      channels: 1,
      bitDepth: 16,
      format: "pcm16",
    });
  }

  getBytesPerSample(): number {
    return this.bitDepth / 8; // 16-bit = 2 bytes
  }

  equals(other: AudioConfig): boolean {
    return (
      this.sampleRate === other.sampleRate &&
      this.channels === other.channels &&
      this.bitDepth === other.bitDepth &&
      this.format === other.format
    );
  }
}
