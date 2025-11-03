import { TranscriptionSession } from "../entities/TranscriptionSession";

export interface ITranscriptionRepository {
  /**
   * Save a new transcription session
   */
  save(session: TranscriptionSession): Promise<void>;

  /**
   * Update an existing transcription session
   */
  update(session: TranscriptionSession): Promise<void>;

  /**
   * Find a session by its ID
   */
  findById(sessionId: string): Promise<TranscriptionSession | null>;

  /**
   * Find a session by socket ID (current session)
   */
  findBySocketId(socketId: string): Promise<TranscriptionSession | null>;

  /**
   * Delete a session
   */
  delete(sessionId: string): Promise<void>;

  /**
   * Find all sessions for a user
   */
  findByUserId(userId: string): Promise<TranscriptionSession[]>;
}
