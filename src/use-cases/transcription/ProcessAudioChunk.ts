import { TranscriptionSession } from "../../domain/entities/TranscriptionSession.js";
import type { ITranscriptionRepository } from "../../domain/repositories/ITranscriptionRepository.js";
import type { ITranscriptionProvider } from "../../domain/repositories/ITranscriptionProvider.js";
import type { ILogger } from "../interfaces/ILogger.js";

export class ProcessAudioChunk {
  constructor(
    private transcriptionRepository: ITranscriptionRepository,
    private transcriptionProvider: ITranscriptionProvider,
    private logger: ILogger
  ) {}

  async execute(
    socketId: string,
    audioData: Uint8Array
  ): Promise<void> {
    try {
      // Validate audio data
      if (!audioData || audioData.length === 0) {
        throw new Error("Audio chunk is empty or invalid");
      }

      // Get current session
      const session = await this.transcriptionRepository.findBySocketId(socketId);
      if (!session) {
        throw new Error(
          "Transcription session not found. Call start_transcription first."
        );
      }

      // Check if session is active
      if (!session.isActive()) {
        throw new Error(
          `Cannot process audio in ${session.status} session state`
        );
      }

      // Send to provider
      this.transcriptionProvider.sendAudio(audioData);

      this.logger.debug("Audio chunk processed", {
        sessionId: session.id.toString(),
        size: audioData.length,
      });
    } catch (error) {
      this.logger.error("Failed to process audio chunk", error);
      throw new Error(
        `Failed to process audio chunk: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
