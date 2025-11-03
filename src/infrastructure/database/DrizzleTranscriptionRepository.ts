import { eq } from "drizzle-orm";
import { TranscriptionSession, SessionStatus } from "../../domain/entities/TranscriptionSession.js";
import type { ITranscriptionRepository } from "../../domain/repositories/ITranscriptionRepository.js";
import { transcriptionSession } from "../../lib/schema.js";
import type { Database } from "../../lib/db.js";
import type { ILogger } from "../../use-cases/interfaces/ILogger.js";

export class DrizzleTranscriptionRepository implements ITranscriptionRepository {
  constructor(
    private db: Database,
    private logger: ILogger
  ) {}

  async save(session: TranscriptionSession): Promise<void> {
    try {
      await this.db
        .insert(transcriptionSession)
        .values({
          id: session.id.toString(),
          socketId: session.socketId,
          status: session.status,
          audioFormat: session.audioConfig.format,
          sampleRate: String(session.audioConfig.sampleRate),
          channels: String(session.audioConfig.channels),
          bitDepth: String(session.audioConfig.bitDepth),
          transcribedText: session.getTranscribedText(),
          results: session.results as any,
          errorMessage: session.errorMessage,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
        });

      this.logger.debug("Transcription session saved", {
        sessionId: session.id.toString(),
      });
    } catch (error) {
      this.logger.error("Failed to save transcription session", error);
      throw new Error(
        `Failed to save transcription session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async update(session: TranscriptionSession): Promise<void> {
    try {
      await this.db
        .update(transcriptionSession)
        .set({
          status: session.status,
          transcribedText: session.getTranscribedText(),
          results: session.results as any,
          errorMessage: session.errorMessage,
          endedAt: session.endedAt,
          updatedAt: new Date(),
        })
        .where(eq(transcriptionSession.id, session.id.toString()));

      this.logger.debug("Transcription session updated", {
        sessionId: session.id.toString(),
      });
    } catch (error) {
      this.logger.error("Failed to update transcription session", error);
      throw new Error(
        `Failed to update transcription session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findById(sessionId: string): Promise<TranscriptionSession | null> {
    try {
      const result = await this.db
        .select()
        .from(transcriptionSession)
        .where(eq(transcriptionSession.id, sessionId))
        .limit(1);

      if (!result || result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error("Failed to find transcription session by ID", error);
      throw error;
    }
  }

  async findBySocketId(socketId: string): Promise<TranscriptionSession | null> {
    try {
      const result = await this.db
        .select()
        .from(transcriptionSession)
        .where(eq(transcriptionSession.socketId, socketId))
        .limit(1);

      if (!result || result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error("Failed to find transcription session by socket ID", error);
      throw error;
    }
  }

  async delete(sessionId: string): Promise<void> {
    try {
      await this.db
        .delete(transcriptionSession)
        .where(eq(transcriptionSession.id, sessionId));

      this.logger.debug("Transcription session deleted", { sessionId });
    } catch (error) {
      this.logger.error("Failed to delete transcription session", error);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<TranscriptionSession[]> {
    // TODO: Implement when user association is added
    return [];
  }

  private mapToEntity(record: any): TranscriptionSession {
    const session = new TranscriptionSession(
      { value: record.id } as any, // SessionId
      record.socketId,
      {
        sampleRate: parseInt(record.sampleRate),
        channels: parseInt(record.channels),
        bitDepth: parseInt(record.bitDepth),
        format: record.audioFormat,
      } as any, // AudioConfig
      new Date(record.startedAt)
    );

    session.status = record.status as SessionStatus;
    session.results = record.results || [];
    session.errorMessage = record.errorMessage;
    if (record.endedAt) {
      session.endedAt = new Date(record.endedAt);
    }

    return session;
  }
}
