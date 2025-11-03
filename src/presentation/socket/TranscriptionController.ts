import { Socket } from "socket.io";
import { StartTranscription } from "../../use-cases/transcription/StartTranscription.js";
import { ProcessAudioChunk } from "../../use-cases/transcription/ProcessAudioChunk.js";
import { StopTranscription } from "../../use-cases/transcription/StopTranscription.js";
import type { ITranscriptionProvider } from "../../domain/repositories/ITranscriptionProvider.js";
import type { ILogger } from "../../use-cases/interfaces/ILogger.js";

export class TranscriptionController {
  constructor(
    private startTranscription: StartTranscription,
    private processAudioChunk: ProcessAudioChunk,
    private stopTranscription: StopTranscription,
    private transcriptionProvider: ITranscriptionProvider,
    private logger: ILogger
  ) {}

  /**
   * Handle transcription_start event
   */
  handleTranscriptionStart = (socket: Socket) => {
    socket.on(
      "transcription_start",
      async (callback?: (error?: any) => void) => {
        try {
          const clientId = socket.id;

          // Start transcription use case
          const session = await this.startTranscription.execute(clientId);

          // Setup event listeners for this provider
          this.setupProviderListeners(socket, session.id.toString());

          this.logger.info("Transcription started via controller", {
            clientId,
            sessionId: session.id.toString(),
          });

          if (callback) {
            callback();
          }

          socket.emit("transcription_started", {
            sessionId: session.id.toString(),
            status: "connected",
          });
        } catch (error) {
          const errorMsg = {
            error: "Failed to start transcription",
            details: error instanceof Error ? error.message : String(error),
          };

          this.logger.error("Transcription start error", errorMsg);

          if (callback) {
            callback(errorMsg);
          }

          socket.emit("transcription_error", errorMsg);
        }
      }
    );
  };

  /**
   * Handle audio_chunk event
   */
  handleAudioChunk = (socket: Socket) => {
    socket.on("audio_chunk", async (data: Uint8Array, callback?: (error?: any) => void) => {
      try {
        const clientId = socket.id;

        // Process audio chunk use case
        await this.processAudioChunk.execute(clientId, data);

        if (callback) {
          callback();
        }
      } catch (error) {
        const errorMsg = {
          error: "Failed to process audio chunk",
          details: error instanceof Error ? error.message : String(error),
        };

        this.logger.error("Audio chunk processing error", errorMsg);

        if (callback) {
          callback(errorMsg);
        }

        socket.emit("transcription_error", errorMsg);
      }
    });
  };

  /**
   * Handle transcription_stop event
   */
  handleTranscriptionStop = (socket: Socket) => {
    socket.on("transcription_stop", async (callback?: (error?: any) => void) => {
      try {
        const clientId = socket.id;

        // Stop transcription use case
        const session = await this.stopTranscription.execute(clientId);

        this.logger.info("Transcription stopped via controller", {
          clientId,
          sessionId: session.id.toString(),
        });

        if (callback) {
          callback();
        }

        socket.emit("transcription_stopped", {
          sessionId: session.id.toString(),
          status: "disconnected",
          transcribedText: session.getTranscribedText(),
        });
      } catch (error) {
        const errorMsg = {
          error: "Failed to stop transcription",
          details: error instanceof Error ? error.message : String(error),
        };

        this.logger.error("Transcription stop error", errorMsg);

        if (callback) {
          callback(errorMsg);
        }

        socket.emit("transcription_error", errorMsg);
      }
    });
  };

  /**
   * Handle disconnect and cleanup
   */
  handleDisconnect = (socket: Socket) => {
    socket.on("disconnect", async (reason: string) => {
      try {
        const clientId = socket.id;

        // Attempt to stop active transcription
        await this.stopTranscription.execute(clientId);

        this.logger.info("Client disconnected and cleaned up", {
          clientId,
          reason,
        });
      } catch (error) {
        // Session might not exist, which is fine
        this.logger.debug("Disconnect cleanup (session may not exist)", {
          clientId: socket.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  };

  /**
   * Setup provider event listeners to emit results back to client
   */
  private setupProviderListeners(socket: Socket, sessionId: string): void {
    // This is a bit of a workaround: we need to forward provider results to the socket
    // The provider was already connected in StartTranscription use case,
    // so we just setup the socket listeners here
    // Results from provider will be emitted back via "transcription_result" event
    // (This is handled via callbacks passed to provider.connect())
  }

  /**
   * Forward transcription result from provider to client socket
   */
  forwardTranscriptionResult(socket: Socket, result: any): void {
    socket.emit("transcription_result", result);
  }

  /**
   * Forward transcription error from provider to client socket
   */
  forwardTranscriptionError(socket: Socket, error: any): void {
    socket.emit("transcription_error", error);
  }
}
