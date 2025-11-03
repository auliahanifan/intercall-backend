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
   * Auto-initialize transcription on first connection
   */
  private async initializeTranscription(clientId: string, socket: Socket): Promise<void> {
    try {
      // Start transcription use case
      const session = await this.startTranscription.execute(clientId);

      // Setup event listeners for this provider
      this.setupProviderListeners(socket, session.id.toString());

      this.logger.info("Transcription initialized", {
        clientId,
        sessionId: session.id.toString(),
      });
    } catch (error) {
      this.logger.error("Failed to initialize transcription", error);
      throw error;
    }
  }

  /**
   * Handle audio_chunk event
   */
  handleAudioChunk = (socket: Socket) => {
    socket.on("audio_chunk", async (data: Uint8Array, callback?: (error: any) => void) => {
      try {
        const clientId = socket.id;

        // Initialize transcription on first chunk if not already done
        try {
          await this.initializeTranscription(clientId, socket);
        } catch (initError) {
          // If initialization fails, acknowledge and return
          if (typeof callback === "function") {
            callback(initError instanceof Error ? initError : new Error(String(initError)));
          }
          return;
        }

        // Process audio chunk use case
        await this.processAudioChunk.execute(clientId, data);

        // Acknowledge success to client
        if (typeof callback === "function") {
          callback(null);
        }
      } catch (error) {
        const errorMsg = {
          error: "Failed to process audio chunk",
          details: error instanceof Error ? error.message : String(error),
        };

        this.logger.error("Audio chunk processing error", errorMsg);

        // Acknowledge error to client
        if (typeof callback === "function") {
          callback(errorMsg);
        }
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
   * Setup provider event listeners
   */
  private setupProviderListeners(socket: Socket, sessionId: string): void {
    // Provider listeners are set up in the StartTranscription use case
  }
}
