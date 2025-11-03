import { SessionId } from "../value-objects/SessionId";
import { AudioConfig } from "../value-objects/AudioConfig";

export enum SessionStatus {
  PENDING = "pending",
  ACTIVE = "active",
  STOPPING = "stopping",
  STOPPED = "stopped",
  ERROR = "error",
}

export interface ITranscriptionToken {
  text: string;
  confidence: number;
  start_ms: number;
  end_ms: number;
}

export class TranscriptionSession {
  readonly id: SessionId;
  readonly socketId: string;
  status: SessionStatus;
  readonly audioConfig: AudioConfig;
  readonly startedAt: Date;
  endedAt?: Date;
  results: ITranscriptionToken[] = [];
  errorMessage?: string;

  constructor(
    id: SessionId,
    socketId: string,
    audioConfig: AudioConfig,
    startedAt: Date = new Date()
  ) {
    this.id = id;
    this.socketId = socketId;
    this.audioConfig = audioConfig;
    this.startedAt = startedAt;
    this.status = SessionStatus.PENDING;
  }

  static create(socketId: string): TranscriptionSession {
    const sessionId = new SessionId();
    const audioConfig = AudioConfig.default();
    return new TranscriptionSession(sessionId, socketId, audioConfig);
  }

  activate(): void {
    if (this.status !== SessionStatus.PENDING) {
      throw new Error(
        `Cannot activate session in ${this.status} status. Must be PENDING.`
      );
    }
    this.status = SessionStatus.ACTIVE;
  }

  addResult(token: ITranscriptionToken): void {
    if (this.status !== SessionStatus.ACTIVE) {
      throw new Error(
        `Cannot add results to session in ${this.status} status. Session must be ACTIVE.`
      );
    }
    this.results.push(token);
  }

  markForStopping(): void {
    if (this.status === SessionStatus.ACTIVE) {
      this.status = SessionStatus.STOPPING;
    }
  }

  markStopped(): void {
    this.status = SessionStatus.STOPPED;
    this.endedAt = new Date();
  }

  markError(message: string): void {
    this.status = SessionStatus.ERROR;
    this.errorMessage = message;
    this.endedAt = new Date();
  }

  getTranscribedText(): string {
    return this.results.map((token) => token.text).join(" ");
  }

  getDurationMs(): number {
    const end = this.endedAt || new Date();
    return end.getTime() - this.startedAt.getTime();
  }

  isActive(): boolean {
    return this.status === SessionStatus.ACTIVE;
  }

  isStopped(): boolean {
    return this.status === SessionStatus.STOPPED;
  }

  hasError(): boolean {
    return this.status === SessionStatus.ERROR;
  }
}
