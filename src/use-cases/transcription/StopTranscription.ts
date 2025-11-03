import { TranscriptionSession } from "../../domain/entities/TranscriptionSession.js";
import type { ITranscriptionRepository } from "../../domain/repositories/ITranscriptionRepository.js";
import type { ITranscriptionProvider } from "../../domain/repositories/ITranscriptionProvider.js";
import type { ILogger } from "../interfaces/ILogger.js";

export class StopTranscription {
  constructor(
    private transcriptionRepository: ITranscriptionRepository,
    private transcriptionProvider: ITranscriptionProvider,
    private logger: ILogger
  ) {}

  async execute(socketId: string): Promise<TranscriptionSession> {
    try {
      // Get current session
      const session = await this.transcriptionRepository.findBySocketId(socketId);
      if (!session) {
        throw new Error(
          "Transcription session not found. No active transcription to stop."
        );
      }

      // Mark for stopping
      session.markForStopping();

      // Close provider connection
      await this.transcriptionProvider.close();

      // Mark stopped
      session.markStopped();

      // Update in database
      await this.transcriptionRepository.update(session);

      this.logger.info("Transcription stopped", {
        sessionId: session.id.toString(),
        durationMs: session.getDurationMs(),
        transcribedText: session.getTranscribedText().substring(0, 100), // Log first 100 chars
      });

      return session;
    } catch (error) {
      this.logger.error("Failed to stop transcription", error);
      throw new Error(
        `Failed to stop transcription: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
