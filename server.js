const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Configuration
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.DIALPAD_WEBHOOK_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEBUG = process.env.DEBUG === 'true';
const ALLOWED_ALGORITHM = 'HS256';
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 1200;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// Socket.IO server with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/webhook', express.text({ type: '*/*', limit: '1mb' }));

// Track rate limit warnings
let rateLimitWarningCount = 0;
let lastRateLimitWarning = 0;
const RATE_LIMIT_WARNING_INTERVAL = 5000;

// Rate limiter for webhook endpoint
const webhookLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const now = Date.now();
    rateLimitWarningCount++;
    
    if (now - lastRateLimitWarning > RATE_LIMIT_WARNING_INTERVAL) {
      console.warn(`⚠️  Rate limit exceeded (${rateLimitWarningCount} blocked in last 5s)`);
      lastRateLimitWarning = now;
      rateLimitWarningCount = 0;
    }
    
    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX} requests per minute.`,
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
    });
  }
});

// WebSocket connection tracking
let connectedClients = 0;
const clientInfo = new Map();

// WebSocket connection handler
io.on('connection', (socket) => {
  connectedClients++;
  const clientId = socket.id;
  const clientIp = socket.handshake.address;
  
  clientInfo.set(clientId, {
    id: clientId,
    ip: clientIp,
    connectedAt: new Date(),
    eventsReceived: 0
  });
  
  console.log(`🔌 Client connected: ${clientId} (Total: ${connectedClients})`);
  
  // Send welcome message
  socket.emit('connected', {
    message: 'Connected to Dialpad WebSocket server',
    clientId: clientId,
    timestamp: new Date().toISOString()
  });
  
  // Handle client subscription to specific events
  socket.on('subscribe', (eventTypes) => {
    if (Array.isArray(eventTypes)) {
      socket.join(eventTypes);
      console.log(`📡 Client ${clientId} subscribed to:`, eventTypes);
      socket.emit('subscribed', { eventTypes });
    }
  });
  
  // Handle ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    connectedClients--;
    const info = clientInfo.get(clientId);
    console.log(`🔌 Client disconnected: ${clientId} (Total: ${connectedClients})`);
    if (DEBUG && info) {
      console.log(`   Duration: ${Math.round((Date.now() - info.connectedAt) / 1000)}s`);
      console.log(`   Events received: ${info.eventsReceived}`);
    }
    clientInfo.delete(clientId);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    environment: NODE_ENV,
    uptime: process.uptime(),
    websocket: {
      connectedClients,
      transport: 'socket.io'
    },
    rateLimit: {
      max: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS
    },
    timestamp: new Date().toISOString()
  });
});

// WebSocket clients info endpoint
app.get('/clients', (req, res) => {
  const clients = Array.from(clientInfo.values()).map(info => ({
    id: info.id,
    connectedAt: info.connectedAt,
    eventsReceived: info.eventsReceived,
    uptime: Math.round((Date.now() - info.connectedAt) / 1000)
  }));
  
  res.json({
    total: connectedClients,
    clients
  });
});

// Dialpad webhook endpoint
app.post('/webhook', webhookLimiter, async (req, res) => {
  try {
    // Get JWT token from request body
    let token = req.body;
    
    // Handle different body types
    if (Buffer.isBuffer(token)) {
      token = token.toString('utf8');
    } else if (typeof token === 'object') {
      token = JSON.stringify(token);
    }
    
    token = token.trim().replace(/^["']|["']$/g, '');
    
    if (!token) {
      console.error('❌ No token received');
      return res.status(400).json({ error: 'No token provided' });
    }

    if (!WEBHOOK_SECRET) {
      console.error('❌ DIALPAD_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Decode header to check algorithm
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.error('❌ Invalid JWT format');
      return res.status(400).json({ error: 'Invalid token format' });
    }
    
    const header = JSON.parse(Buffer.from(tokenParts[0], 'base64').toString());
    
    // Verify algorithm
    if (header.alg !== ALLOWED_ALGORITHM) {
      console.error(`❌ Invalid algorithm: ${header.alg}`);
      return res.status(401).json({ 
        error: 'Invalid algorithm',
        details: DEBUG ? `Expected ${ALLOWED_ALGORITHM}, got ${header.alg}` : undefined
      });
    }

    // Verify and decode JWT
    const decoded = jwt.verify(token, WEBHOOK_SECRET, { 
      algorithms: [ALLOWED_ALGORITHM]
    });

    const eventType = decoded.type;
    const eventData = decoded.data || decoded;

    if (DEBUG) {
      console.log(`✓ Webhook received: ${eventType}`);
    } else {
      console.log(`✓ ${eventType} - ${new Date().toISOString()}`);
    }

    // Broadcast to all connected WebSocket clients
    const event = {
      type: eventType,
      data: eventData,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast to all clients
    io.emit('dialpad:event', event);
    
    // Also emit to specific event room if clients subscribed
    io.to(eventType).emit(eventType, event);
    
    // Update client stats
    clientInfo.forEach((info) => {
      info.eventsReceived++;
    });
    
    if (DEBUG) {
      console.log(`   Broadcasted to ${connectedClients} client(s)`);
    }

    // Respond quickly to Dialpad
    res.status(200).json({ 
      success: true,
      broadcasted: connectedClients,
      received: new Date().toISOString()
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      console.error('❌ Invalid JWT signature');
      return res.status(401).json({ 
        error: 'Invalid signature',
        details: DEBUG ? error.message : undefined
      });
    } else if (error.name === 'TokenExpiredError') {
      console.error('❌ JWT token expired');
      return res.status(401).json({ error: 'Token expired' });
    } else {
      console.error('❌ Webhook processing error:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        details: DEBUG ? error.message : undefined
      });
    }
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Graceful error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Dialpad WebSocket Server`);
  console.log(`Environment: ${NODE_ENV.toUpperCase()}`);
  console.log(`Port: ${PORT}`);
  console.log(`\n📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`📥 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`👥 Clients info: http://localhost:${PORT}/clients`);
  console.log(`\n🔐 JWT Algorithm: ${ALLOWED_ALGORITHM} only`);
  console.log(`⏱️  Rate limit: ${RATE_LIMIT_MAX} requests/${RATE_LIMIT_WINDOW_MS/1000}s`);
  
  if (!WEBHOOK_SECRET) {
    console.warn('\n⚠️  WARNING: DIALPAD_WEBHOOK_SECRET not set!');
  } else {
    console.log('✓ Webhook secret configured');
  }
  
  if (DEBUG) {
    console.log('\n⚠️  DEBUG MODE ENABLED\n');
  }
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n👋 Shutting down gracefully...');
  
  // Notify all connected clients
  io.emit('server:shutdown', {
    message: 'Server is shutting down',
    timestamp: new Date().toISOString()
  });
  
  // Close WebSocket connections
  io.close(() => {
    console.log('✓ WebSocket server closed');
    
    // Close HTTP server
    httpServer.close(() => {
      console.log('✓ HTTP server closed');
      process.exit(0);
    });
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
