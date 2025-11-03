import { AudioConfig } from "../value-objects/AudioConfig";

export interface ITranscriptionResult {
  tokens: Array<{
    text: string;
    confidence: number;
    start_ms: number;
    end_ms: number;
  }>;
  is_final: boolean;
  speaker?: string;
}

export interface ITranscriptionError {
  error: string;
  details?: string;
}

export interface ITranscriptionProvider {
  /**
   * Connect to the transcription service
   */
  connect(
    onResult: (result: ITranscriptionResult) => void,
    onError: (error: ITranscriptionError) => void
  ): Promise<void>;

  /**
   * Send audio chunk to the provider
   */
  sendAudio(audioData: Uint8Array): void;

  /**
   * Close the connection gracefully
   */
  close(): Promise<void>;

  /**
   * Check if connected
   */
  isConnected(): boolean;
}
