import type { Database } from "../lib/db.js";
import { LogtailLogger } from "../infrastructure/logging/LogtailLogger.js";
import { DrizzleTranscriptionRepository } from "../infrastructure/database/DrizzleTranscriptionRepository.js";
import { SonioxProvider } from "../infrastructure/transcription/SonioxProvider.js";
import { StartTranscription } from "../use-cases/transcription/StartTranscription.js";
import { ProcessAudioChunk } from "../use-cases/transcription/ProcessAudioChunk.js";
import { StopTranscription } from "../use-cases/transcription/StopTranscription.js";
import { TranscriptionController } from "../presentation/socket/TranscriptionController.js";
import type { ILogger } from "../use-cases/interfaces/ILogger.js";
import type { ITranscriptionRepository } from "../domain/repositories/ITranscriptionRepository.js";
import type { ITranscriptionProvider } from "../domain/repositories/ITranscriptionProvider.js";

/**
 * Dependency Factory for manual DI wiring
 * Follows the composition root pattern
 */
export class DependencyFactory {
  private static instance: DependencyFactory;
  private logger: ILogger;
  private db: Database;

  private constructor(db: Database) {
    this.db = db;
    this.logger = new LogtailLogger();
  }

  static initialize(db: Database): DependencyFactory {
    DependencyFactory.instance = new DependencyFactory(db);
    return DependencyFactory.instance;
  }

  static getInstance(): DependencyFactory {
    if (!DependencyFactory.instance) {
      throw new Error(
        "DependencyFactory not initialized. Call initialize() first."
      );
    }
    return DependencyFactory.instance;
  }

  getLogger(): ILogger {
    return this.logger;
  }

  getDatabase(): Database {
    return this.db;
  }

  /**
   * Create Transcription Repository
   */
  createTranscriptionRepository(): ITranscriptionRepository {
    return new DrizzleTranscriptionRepository(this.db, this.logger);
  }

  /**
   * Create Transcription Provider (Soniox)
   * Note: This creates a new instance per use, as each client needs its own connection
   */
  createTranscriptionProvider(clientId: string): ITranscriptionProvider {
    return new SonioxProvider(clientId, this.logger);
  }

  /**
   * Create StartTranscription Use Case
   */
  createStartTranscriptionUseCase(
    provider: ITranscriptionProvider
  ): StartTranscription {
    const repository = this.createTranscriptionRepository();
    return new StartTranscription(repository, provider, this.logger);
  }

  /**
   * Create ProcessAudioChunk Use Case
   */
  createProcessAudioChunkUseCase(
    provider: ITranscriptionProvider
  ): ProcessAudioChunk {
    const repository = this.createTranscriptionRepository();
    return new ProcessAudioChunk(repository, provider, this.logger);
  }

  /**
   * Create StopTranscription Use Case
   */
  createStopTranscriptionUseCase(
    provider: ITranscriptionProvider
  ): StopTranscription {
    const repository = this.createTranscriptionRepository();
    return new StopTranscription(repository, provider, this.logger);
  }

  /**
   * Create TranscriptionController
   * This is the main entry point for Socket.IO integration
   */
  createTranscriptionController(
    clientId: string
  ): TranscriptionController {
    const provider = this.createTranscriptionProvider(clientId);
    const startUseCase = this.createStartTranscriptionUseCase(provider);
    const processUseCase = this.createProcessAudioChunkUseCase(provider);
    const stopUseCase = this.createStopTranscriptionUseCase(provider);

    return new TranscriptionController(
      startUseCase,
      processUseCase,
      stopUseCase,
      provider,
      this.logger
    );
  }
}
