import { supabaseConfig } from '../config/supabase.js';
import { handleAICommand } from '../services/aiAgent.js';
import { logger } from '../utils/logger.js';

const activeUsers = new Map();
const userCursors = new Map();

export function initializeSocketHandlers(io) {
  io.on('connection', async (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // Authenticate socket connection
    try {
      const token = socket.handshake.auth.token || 
                    socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (token) {
        const user = await supabaseConfig.verifyIdToken(token);
        socket.userId = user.uid;
        socket.userEmail = user.email;
        logger.info('Socket authenticated', { userId: user.uid });
      }
    } catch (error) {
      logger.warn('Socket authentication failed', { error: error.message });
    }

    // Join board room
    socket.on('join_board', async ({ boardId }) => {
      try {
        socket.join(`board:${boardId}`);
        socket.currentBoard = boardId;

        // Track active user
        if (!activeUsers.has(boardId)) {
          activeUsers.set(boardId, new Set());
        }
        activeUsers.get(boardId).add(socket.userId || socket.id);

        // Send current objects
        const objects = await supabaseConfig.getObjects(boardId);
        socket.emit('board_state', { objects });

        // Notify others
        socket.to(`board:${boardId}`).emit('user_joined', {
          userId: socket.userId || socket.id,
          userEmail: socket.userEmail
        });

        // Send active users count
        io.to(`board:${boardId}`).emit('active_users', {
          count: activeUsers.get(boardId).size
        });

        logger.info('User joined board', { boardId, userId: socket.userId });
      } catch (error) {
        logger.error('Join board failed', { error: error.message, boardId });
        socket.emit('error', { message: 'Failed to join board' });
      }
    });

    // Leave board room
    socket.on('leave_board', ({ boardId }) => {
      socket.leave(`board:${boardId}`);
      
      if (activeUsers.has(boardId)) {
        activeUsers.get(boardId).delete(socket.userId || socket.id);
        io.to(`board:${boardId}`).emit('active_users', {
          count: activeUsers.get(boardId).size
        });
      }

      userCursors.delete(`${boardId}:${socket.id}`);
      
      socket.to(`board:${boardId}`).emit('user_left', {
        userId: socket.userId || socket.id
      });
    });

    // Create object
    socket.on('create_object', async (data) => {
      try {
        const object = await supabaseConfig.createObject({
          ...data,
          createdBy: socket.userId
        });

        io.to(`board:${data.boardId}`).emit('object_created', {
          object,
          userId: socket.userId
        });

        logger.debug('Object created', { boardId: data.boardId, objectId: object.id });
      } catch (error) {
        logger.error('Create object failed', { error: error.message });
        socket.emit('error', { message: 'Failed to create object' });
      }
    });

    // Update object
    socket.on('update_object', async (data) => {
      try {
        await supabaseConfig.updateObject(data.objectId, data.updates);

        socket.to(`board:${socket.currentBoard}`).emit('object_updated', {
          objectId: data.objectId,
          updates: data.updates,
          userId: socket.userId
        });

        logger.debug('Object updated', { objectId: data.objectId });
      } catch (error) {
        logger.error('Update object failed', { error: error.message });
        socket.emit('error', { message: 'Failed to update object' });
      }
    });

    // Delete object
    socket.on('delete_object', async (data) => {
      try {
        await supabaseConfig.deleteObject(data.objectId);

        io.to(`board:${socket.currentBoard}`).emit('object_deleted', {
          objectId: data.objectId,
          userId: socket.userId
        });

        logger.debug('Object deleted', { objectId: data.objectId });
      } catch (error) {
        logger.error('Delete object failed', { error: error.message });
        socket.emit('error', { message: 'Failed to delete object' });
      }
    });

    // Cursor movement
    socket.on('cursor_move', (data) => {
      const cursorKey = `${socket.currentBoard}:${socket.id}`;
      userCursors.set(cursorKey, {
        x: data.x,
        y: data.y,
        userId: socket.userId || socket.id,
        userEmail: socket.userEmail
      });

      socket.to(`board:${socket.currentBoard}`).emit('cursor_moved', {
        socketId: socket.id,
        x: data.x,
        y: data.y,
        userId: socket.userId,
        userEmail: socket.userEmail
      });
    });

    // AI command
    socket.on('ai_command', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('ai_response', {
            success: false,
            message: 'Authentication required for AI features'
          });
          return;
        }

        logger.info('AI command received', { 
          boardId: data.boardId, 
          command: data.command 
        });

        const result = await handleAICommand({
          boardId: data.boardId,
          userId: socket.userId,
          command: data.command,
          io
        });

        socket.emit('ai_response', result);
      } catch (error) {
        logger.error('AI command failed', { error: error.message });
        socket.emit('ai_response', {
          success: false,
          message: error.message
        });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });

      if (socket.currentBoard) {
        const boardId = socket.currentBoard;
        
        if (activeUsers.has(boardId)) {
          activeUsers.get(boardId).delete(socket.userId || socket.id);
          io.to(`board:${boardId}`).emit('active_users', {
            count: activeUsers.get(boardId).size
          });
        }

        userCursors.delete(`${boardId}:${socket.id}`);

        socket.to(`board:${boardId}`).emit('user_left', {
          userId: socket.userId || socket.id
        });
      }
    });
  });

  return io;
}
