import { Socket } from "socket.io";
import { logger } from "./logger";

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
 * Initialize all event handlers for a socket connection
 */
export function initializeSocketHandlers(socket: Socket) {
  handleMessage(socket);
  handleUserPresence(socket);
  handleRoomEvents(socket);
  handleTypingIndicators(socket);
}
