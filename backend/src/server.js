import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initializeSocketHandlers } from './websocket/socketHandler.js';
import { supabaseConfig } from './config/supabase.js';
import { redisClient } from './config/redis.js';
import authRoutes from './routes/auth.js';
import boardRoutes from './routes/boards.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: false, // Configure based on your needs
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check endpoint (required for GCP Cloud Run)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);

app.get('/api/status', (req, res) => {
  res.json({
    service: 'AI Whiteboard API',
    version: '1.0.0',
    database: 'Supabase PostgreSQL',
    ai_enabled: !!process.env.ANTHROPIC_API_KEY
  });
});

// WebSocket Setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
  },
  pingInterval: parseInt(process.env.WS_PING_INTERVAL) || 25000,
  pingTimeout: parseInt(process.env.WS_PING_TIMEOUT) || 5000,
  maxHttpBufferSize: 1e6, // 1MB
  transports: ['websocket', 'polling']
});

initializeSocketHandlers(io);

// Error handling
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing server gracefully...');
  
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Firebase Admin SDK handles cleanup automatically
      logger.info('Firebase connections closed');
      
      await redisClient.quit();
      logger.info('Redis connection closed');
      
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown', err);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    // Initialize Firebase
    await supabaseConfig.initialize();
    logger.info('Firebase initialized');
    
    // Initialize Redis
    await redisClient.connect();
    logger.info('Redis connected');
    
    httpServer.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running on ${HOST}:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Database: Supabase PostgreSQL`);
      logger.info(`AI Agent: ${process.env.ANTHROPIC_API_KEY ? 'Enabled' : 'Disabled'}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();

export { app, io };
