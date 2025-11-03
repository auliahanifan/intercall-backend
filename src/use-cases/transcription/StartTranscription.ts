import { TranscriptionSession } from "../../domain/entities/TranscriptionSession.js";
import type { ITranscriptionRepository } from "../../domain/repositories/ITranscriptionRepository.js";
import type { ITranscriptionProvider } from "../../domain/repositories/ITranscriptionProvider.js";
import type { ILogger } from "../interfaces/ILogger.js";

export class StartTranscription {
  constructor(
    private transcriptionRepository: ITranscriptionRepository,
    private transcriptionProvider: ITranscriptionProvider,
    private logger: ILogger
  ) {}

  async execute(socketId: string): Promise<TranscriptionSession> {
    try {
      // Create new transcription session
      const session = TranscriptionSession.create(socketId);

      // Connect to transcription provider
      await this.transcriptionProvider.connect(
        (result) => {
          // Handle result in the use case if needed
          // For now, this is handled at controller level
        },
        (error) => {
          // Handle error
          session.markError(error.error);
        }
      );

      // Activate session
      session.activate();

      // Persist to database
      await this.transcriptionRepository.save(session);

      this.logger.info("Transcription started", {
        sessionId: session.id.toString(),
        socketId,
      });

      return session;
    } catch (error) {
      this.logger.error("Failed to start transcription", error);
      throw new Error(
        `Failed to start transcription: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
