import WebSocket from "ws";
import { logger } from "./logger";

export interface TranscriptionResult {
  tokens: Array<{
    text: string;
    confidence: number;
    start_ms: number;
    end_ms: number;
  }>;
  is_final: boolean;
  speaker?: string;
}

export interface TranscriptionError {
  error: string;
  details?: string;
}

type ResultCallback = (result: TranscriptionResult) => void;
type ErrorCallback = (error: TranscriptionError) => void;

export class SonioxTranscriptionService {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private clientId: string;
  private resultCallback: ResultCallback | null = null;
  private errorCallback: ErrorCallback | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;

  constructor(clientId: string) {
    const apiKey = process.env.SONIOX_API_KEY;
    if (!apiKey) {
      throw new Error("SONIOX_API_KEY not found in environment variables");
    }
    this.apiKey = apiKey;
    this.clientId = clientId;
  }

  /**
   * Connect to Soniox WebSocket API
   */
  async connect(
    onResult: ResultCallback,
    onError: ErrorCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.resultCallback = onResult;
        this.errorCallback = onError;

        const wsUrl = "wss://stt-rt.soniox.com/transcribe-websocket";

        this.ws = new WebSocket(wsUrl);

        this.ws.on("open", () => {
          logger.info("Soniox WebSocket connected", { clientId: this.clientId });
          this.isConnected = true;
          this.reconnectAttempts = 0;

          // Send configuration message
          const config = {
            api_key: this.apiKey,
            model: "stt-rt-preview",
            audio_format: "pcm16",
            sample_rate_hertz: 48000,
            language_code: "en-US",
          };

          this.ws!.send(JSON.stringify(config));
          resolve();
        });

        this.ws.on("message", (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on("error", (error: Error) => {
          logger.error("Soniox WebSocket error", {
            clientId: this.clientId,
            error: error.message,
          });
          this.isConnected = false;

          if (this.errorCallback) {
            this.errorCallback({
              error: "WebSocket error",
              details: error.message,
            });
          }

          reject(error);
        });

        this.ws.on("close", () => {
          logger.info("Soniox WebSocket closed", { clientId: this.clientId });
          this.isConnected = false;
        });
      } catch (error) {
        logger.error("Failed to connect to Soniox", {
          clientId: this.clientId,
          error,
        });
        reject(error);
      }
    });
  }

  /**
   * Send audio chunk to Soniox
   */
  sendAudio(audioData: Uint8Array): void {
    if (!this.ws || !this.isConnected) {
      const error = {
        error: "Soniox connection not established",
        details:
          "WebSocket is not connected. Call connect() first before sending audio.",
      };
      logger.error("Audio send failed", { clientId: this.clientId, ...error });

      if (this.errorCallback) {
        this.errorCallback(error);
      }
      return;
    }

    try {
      // Send binary audio frame
      this.ws.send(audioData);
    } catch (error) {
      const errorMsg = {
        error: "Failed to send audio to Soniox",
        details: error instanceof Error ? error.message : String(error),
      };
      logger.error("Audio send error", {
        clientId: this.clientId,
        ...errorMsg,
      });

      if (this.errorCallback) {
        this.errorCallback(errorMsg);
      }
    }
  }

  /**
   * Handle incoming messages from Soniox
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      if (typeof data === "string") {
        const response = JSON.parse(data);

        // Check for error response
        if (response.error) {
          logger.error("Soniox returned error", {
            clientId: this.clientId,
            error: response.error,
          });

          if (this.errorCallback) {
            this.errorCallback({
              error: response.error,
              details: response.details || undefined,
            });
          }
          return;
        }

        // Process transcription result
        if (response.tokens) {
          const result: TranscriptionResult = {
            tokens: response.tokens,
            is_final: response.is_final || false,
            speaker: response.speaker,
          };

          logger.info("Transcription result received", {
            clientId: this.clientId,
            tokenCount: response.tokens.length,
            isFinal: result.is_final,
          });

          if (this.resultCallback) {
            this.resultCallback(result);
          }
        }
      }
    } catch (error) {
      logger.error("Failed to parse Soniox message", {
        clientId: this.clientId,
        error: error instanceof Error ? error.message : String(error),
        rawData: typeof data === "string" ? data : "[binary data]",
      });

      if (this.errorCallback) {
        this.errorCallback({
          error: "Failed to parse transcription response",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Close the Soniox connection
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve();
        return;
      }

      try {
        // Send empty frame to signal end of stream
        this.ws.send("");

        // Close after a short delay to allow final responses
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
          }
          this.isConnected = false;
          logger.info("Soniox connection closed gracefully", {
            clientId: this.clientId,
          });
          resolve();
        }, 500);
      } catch (error) {
        logger.error("Error closing Soniox connection", {
          clientId: this.clientId,
          error,
        });
        this.isConnected = false;
        resolve();
      }
    });
  }

  /**
   * Check if service is connected
   */
  isConnectedStatus(): boolean {
    return this.isConnected;
  }
}
