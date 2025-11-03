import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { logger } from "./logger.js";
import { DependencyFactory } from "../config/DependencyFactory.js";
import { TranscriptionController } from "../presentation/socket/TranscriptionController.js";

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO with Clean Architecture controllers
 */
export function initializeSocketIO(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: true, // Allow all origins
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // Middleware for logging connections
  io.use((socket, next) => {
    logger.info("Socket.IO connection attempt", {
      socketId: socket.id,
      headers: socket.handshake.headers,
    });
    next();
  });

  // Connection handler
  io.on("connection", (socket: Socket) => {
    logger.info("Socket.IO client connected", {
      socketId: socket.id,
      remoteAddress: socket.handshake.address,
    });

    // Initialize transcription controller with dependency injection
    const transcriptionController =
      DependencyFactory.getInstance().createTranscriptionController(socket.id);

    // Register transcription event handlers
    transcriptionController.handleAudioChunk(socket);
    transcriptionController.handleDisconnect(socket);

    // Error handler
    socket.on("error", (error: any) => {
      logger.error("Socket.IO error", {
        socketId: socket.id,
        error,
      });
    });
  });

  logger.info("Socket.IO initialized with Clean Architecture");
  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initializeSocketIO first.");
  }
  return io;
}

export default { initializeSocketIO, getIO };
