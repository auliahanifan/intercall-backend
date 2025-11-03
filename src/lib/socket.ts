import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { logger } from "./logger";
import { initializeSocketHandlers } from "./socketHandlers";

let io: SocketIOServer | null = null;

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

    // Initialize all event handlers for this socket
    initializeSocketHandlers(socket);

    // Disconnect handler
    socket.on("disconnect", (reason: string) => {
      logger.info("Socket.IO client disconnected", {
        socketId: socket.id,
        reason,
      });
    });

    // Error handler
    socket.on("error", (error: any) => {
      logger.error("Socket.IO error", {
        socketId: socket.id,
        error,
      });
    });
  });

  logger.info("Socket.IO initialized");
  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initializeSocketIO first.");
  }
  return io;
}

export default { initializeSocketIO, getIO };
