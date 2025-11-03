import { randomUUID } from "crypto";

export class SessionId {
  readonly value: string;

  constructor(value?: string) {
    this.value = value || randomUUID();
  }

  static fromString(value: string): SessionId {
    if (!value || value.trim() === "") {
      throw new Error("SessionId cannot be empty");
    }
    return new SessionId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: SessionId): boolean {
    return this.value === other.value;
  }
}
