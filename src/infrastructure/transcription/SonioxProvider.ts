import WebSocket from "ws";
import type { ITranscriptionProvider, ITranscriptionResult, ITranscriptionError } from "../../domain/repositories/ITranscriptionProvider.js";
import type { ILogger } from "../../use-cases/interfaces/ILogger.js";

export class SonioxProvider implements ITranscriptionProvider {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private clientId: string;
  private resultCallback: ((result: ITranscriptionResult) => void) | null = null;
  private errorCallback: ((error: ITranscriptionError) => void) | null = null;
  private isConnectedStatus: boolean = false;

  constructor(clientId: string, private logger: ILogger) {
    const apiKey = process.env.SONIOX_API_KEY;
    if (!apiKey) {
      throw new Error("SONIOX_API_KEY not found in environment variables");
    }
    this.apiKey = apiKey;
    this.clientId = clientId;
  }

  async connect(
    onResult: (result: ITranscriptionResult) => void,
    onError: (error: ITranscriptionError) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.resultCallback = onResult;
        this.errorCallback = onError;

        const wsUrl = "wss://stt-rt.soniox.com/transcribe-websocket";

        this.ws = new WebSocket(wsUrl);

        let resolved = false;
        let hasError = false;

        this.ws.on("open", () => {
          this.logger.info("Soniox WebSocket connected", {
            clientId: this.clientId,
          });
          this.isConnectedStatus = true;

          // Send configuration message with retry logic
          const sendConfig = () => {
            const config = {
              api_key: this.apiKey,
              model: "stt-rt-preview",
              audio_format: "pcm16",
              sample_rate_hertz: 48000,
              language_code: "en-US",
            };

            try {
              // Check readyState before sending
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(config));
                if (!resolved && !hasError) {
                  resolved = true;
                  resolve();
                }
              } else {
                // Retry after a short delay
                setTimeout(sendConfig, 50);
              }
            } catch (sendError) {
              this.logger.error("Failed to send config to Soniox", {
                clientId: this.clientId,
                error: sendError,
              });
              if (!resolved && !hasError) {
                hasError = true;
                reject(sendError);
              }
            }
          };

          sendConfig();
        });

        this.ws.on("message", (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on("error", (error: Error) => {
          this.logger.error("Soniox WebSocket error", {
            clientId: this.clientId,
            error: error.message,
          });
          this.isConnectedStatus = false;

          if (this.errorCallback) {
            this.errorCallback({
              error: "WebSocket error",
              details: error.message,
            });
          }

          if (!resolved && !hasError) {
            hasError = true;
            reject(error);
          }
        });

        this.ws.on("close", () => {
          this.logger.info("Soniox WebSocket closed", {
            clientId: this.clientId,
          });
          this.isConnectedStatus = false;
        });
      } catch (error) {
        this.logger.error("Failed to connect to Soniox", {
          clientId: this.clientId,
          error,
        });
        reject(error);
      }
    });
  }

  sendAudio(audioData: Uint8Array): void {
    if (!this.ws || !this.isConnectedStatus) {
      const error = {
        error: "Soniox connection not established",
        details:
          "WebSocket is not connected. Call connect() first before sending audio.",
      };
      this.logger.error("Audio send failed", {
        clientId: this.clientId,
        ...error,
      });

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
      this.logger.error("Audio send error", {
        clientId: this.clientId,
        ...errorMsg,
      });

      if (this.errorCallback) {
        this.errorCallback(errorMsg);
      }
    }
  }

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
          this.isConnectedStatus = false;
          this.logger.info("Soniox connection closed gracefully", {
            clientId: this.clientId,
          });
          resolve();
        }, 500);
      } catch (error) {
        this.logger.error("Error closing Soniox connection", {
          clientId: this.clientId,
          error,
        });
        this.isConnectedStatus = false;
        resolve();
      }
    });
  }

  isConnected(): boolean {
    return this.isConnectedStatus;
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      if (typeof data === "string") {
        const response = JSON.parse(data);

        // Check for error response
        if (response.error) {
          this.logger.error("Soniox returned error", {
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
          const result: ITranscriptionResult = {
            tokens: response.tokens,
            is_final: response.is_final || false,
            speaker: response.speaker,
          };

          this.logger.info("Transcription result received", {
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
      this.logger.error("Failed to parse Soniox message", {
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
}
