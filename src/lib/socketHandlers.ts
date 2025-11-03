import { Socket } from "socket.io";
import { logger } from "./logger";
import { SonioxTranscriptionService } from "./soniox";

/**
 * Example event handlers for Socket.IO
 * You can expand these to handle your application-specific events
 */

export interface MessageEvent {
  content: string;
  timestamp?: number;
}

export interface UserEvent {
  userId: string;
  username: string;
}

// Map to store Soniox services per socket client
const sonioxServices = new Map<string, SonioxTranscriptionService>();

/**
 * Handle message events
 */
export function handleMessage(socket: Socket) {
  socket.on("send_message", (data: MessageEvent, callback) => {
    logger.info("Message event received", {
      socketId: socket.id,
      content: data.content,
    });

    // Acknowledge the message
    if (callback) {
      callback({ success: true, receivedAt: new Date().toISOString() });
    }

    // Broadcast to all other clients
    socket.broadcast.emit("receive_message", {
      from: socket.id,
      ...data,
      receivedAt: new Date().toISOString(),
    });
  });
}

/**
 * Handle user presence events
 */
export function handleUserPresence(socket: Socket) {
  socket.on("user_online", (data: UserEvent) => {
    logger.info("User online", { socketId: socket.id, userId: data.userId });

    // Notify all other clients about this user coming online
    socket.broadcast.emit("user_status_changed", {
      userId: data.userId,
      username: data.username,
      status: "online",
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("user_offline", (data: UserEvent) => {
    logger.info("User offline", { socketId: socket.id, userId: data.userId });

    // Notify all other clients about this user going offline
    socket.broadcast.emit("user_status_changed", {
      userId: data.userId,
      username: data.username,
      status: "offline",
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Handle room/channel join events
 */
export function handleRoomEvents(socket: Socket) {
  socket.on("join_room", (roomId: string) => {
    socket.join(roomId);
    logger.info("User joined room", { socketId: socket.id, roomId });

    // Notify others in the room
    socket.to(roomId).emit("user_joined_room", {
      socketId: socket.id,
      roomId,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("leave_room", (roomId: string) => {
    socket.leave(roomId);
    logger.info("User left room", { socketId: socket.id, roomId });

    // Notify others in the room
    socket.to(roomId).emit("user_left_room", {
      socketId: socket.id,
      roomId,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("send_room_message", (roomId: string, message: MessageEvent) => {
    logger.info("Room message sent", { socketId: socket.id, roomId });

    // Send message only to users in the room
    socket.to(roomId).emit("receive_room_message", {
      from: socket.id,
      roomId,
      ...message,
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Handle typing indicators
 */
export function handleTypingIndicators(socket: Socket) {
  socket.on("typing_start", (roomId: string) => {
    socket.to(roomId).emit("user_typing", {
      socketId: socket.id,
      roomId,
    });
  });

  socket.on("typing_stop", (roomId: string) => {
    socket.to(roomId).emit("user_stopped_typing", {
      socketId: socket.id,
      roomId,
    });
  });
}

/**
 * Handle transcription start - initialize Soniox connection
 */
export function handleTranscriptionStart(socket: Socket) {
  socket.on("transcription_start", async (callback?: (error?: any) => void) => {
    try {
      const clientId = socket.id;

      // Check if already connected
      if (sonioxServices.has(clientId)) {
        const error = {
          error: "Transcription already started",
          details: "A transcription session is already active for this client",
        };
        logger.warn("Transcription start attempted while already active", {
          clientId,
        });

        if (callback) {
          callback(error);
        }
        socket.emit("transcription_error", error);
        return;
      }

      // Create and connect Soniox service
      const service = new SonioxTranscriptionService(clientId);

      await service.connect(
        (result) => {
          // Send transcription result back to client
          socket.emit("transcription_result", result);
        },
        (error) => {
          // Send error back to client
          socket.emit("transcription_error", error);
        }
      );

      sonioxServices.set(clientId, service);

      logger.info("Transcription started", { clientId });

      if (callback) {
        callback();
      }

      socket.emit("transcription_started", { status: "connected" });
    } catch (error) {
      const errorMsg = {
        error: "Failed to start transcription",
        details: error instanceof Error ? error.message : String(error),
      };

      logger.error("Transcription start error", {
        clientId: socket.id,
        error: errorMsg,
      });

      if (callback) {
        callback(errorMsg);
      }

      socket.emit("transcription_error", errorMsg);
    }
  });
}

/**
 * Handle audio chunks - forward to Soniox
 */
export function handleAudioChunk(socket: Socket) {
  socket.on("audio_chunk", (data: Uint8Array, callback?: (error?: any) => void) => {
    try {
      const clientId = socket.id;
      const service = sonioxServices.get(clientId);

      if (!service) {
        const error = {
          error: "Transcription not started",
          details: "Call transcription_start before sending audio chunks",
        };

        logger.warn("Audio chunk received without active transcription", {
          clientId,
        });

        if (callback) {
          callback(error);
        }

        socket.emit("transcription_error", error);
        return;
      }

      // Validate audio data
      if (!data || data.length === 0) {
        const error = {
          error: "Invalid audio data",
          details: "Audio chunk is empty or invalid",
        };

        logger.warn("Invalid audio chunk received", { clientId });

        if (callback) {
          callback(error);
        }

        return;
      }

      // Send audio to Soniox
      service.sendAudio(data);

      logger.debug("Audio chunk sent to Soniox", {
        clientId,
        size: data.length,
      });

      if (callback) {
        callback();
      }
    } catch (error) {
      const errorMsg = {
        error: "Failed to process audio chunk",
        details: error instanceof Error ? error.message : String(error),
      };

      logger.error("Audio chunk processing error", {
        clientId: socket.id,
        error: errorMsg,
      });

      if (callback) {
        callback(errorMsg);
      }

      socket.emit("transcription_error", errorMsg);
    }
  });
}

/**
 * Handle transcription stop - close Soniox connection
 */
export function handleTranscriptionStop(socket: Socket) {
  socket.on("transcription_stop", async (callback?: (error?: any) => void) => {
    try {
      const clientId = socket.id;
      const service = sonioxServices.get(clientId);

      if (!service) {
        const error = {
          error: "No active transcription",
          details: "There is no active transcription session to stop",
        };

        logger.warn("Transcription stop attempted without active session", {
          clientId,
        });

        if (callback) {
          callback(error);
        }

        socket.emit("transcription_error", error);
        return;
      }

      await service.close();
      sonioxServices.delete(clientId);

      logger.info("Transcription stopped", { clientId });

      if (callback) {
        callback();
      }

      socket.emit("transcription_stopped", { status: "disconnected" });
    } catch (error) {
      const errorMsg = {
        error: "Failed to stop transcription",
        details: error instanceof Error ? error.message : String(error),
      };

      logger.error("Transcription stop error", {
        clientId: socket.id,
        error: errorMsg,
      });

      if (callback) {
        callback(errorMsg);
      }

      socket.emit("transcription_error", errorMsg);
    }
  });
}

/**
 * Clean up Soniox connection on disconnect
 */
export function handleDisconnect(socket: Socket) {
  socket.on("disconnect", async (reason: string) => {
    try {
      const clientId = socket.id;
      const service = sonioxServices.get(clientId);

      if (service) {
        await service.close();
        sonioxServices.delete(clientId);

        logger.info("Soniox connection cleaned up on disconnect", {
          clientId,
          reason,
        });
      }
    } catch (error) {
      logger.error("Error cleaning up Soniox connection", {
        clientId: socket.id,
        error,
      });
    }
  });
}

/**
 * Initialize all event handlers for a socket connection
 */
export function initializeSocketHandlers(socket: Socket) {
  handleMessage(socket);
  handleUserPresence(socket);
  handleRoomEvents(socket);
  handleTypingIndicators(socket);
  handleTranscriptionStart(socket);
  handleAudioChunk(socket);
  handleTranscriptionStop(socket);
  handleDisconnect(socket);
}
