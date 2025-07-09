require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

const apiRoutes = require('./api');
const { initializeWebSocket } = require('./websocket');
const { validateEnvironment } = require('./utils/config');

const app = express();
const server = http.createServer(app);

// Validate environment configuration
validateEnvironment();

// Public health endpoint - must be before any middleware
app.get('/public-status', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    config: {
      domain: process.env.TP_DOMAIN,
      hasUsername: !!process.env.TP_USERNAME,
      hasPassword: !!process.env.TP_PASSWORD,
      hasApiToken: !!process.env.TP_API_TOKEN
    }
  });
});

// Security middleware with CSP for D3.js and Vercel deployment
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "*.vercel.app"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "*.vercel.app"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://d3js.org", "https://unpkg.com", "*.vercel.app"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "*.vercel.app"],
      imgSrc: ["'self'", "data:", "https:", "*.vercel.app"],
      connectSrc: ["'self'", "ws:", "wss:", "https:", "*.vercel.app"],
      frameSrc: ["'self'", "https:", "*.vercel.app"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "*.vercel.app"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration for TargetProcess integration
const corsOptions = {
  origin: (origin, callback) => {
    // In production, allow Vercel domains and configured origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'https://sankeyserver-3zotqlplm-corby-james-projects.vercel.app',
      'https://sankeyserver-io2sg2f44-corby-james-projects.vercel.app'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all Vercel preview URLs
    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, be more permissive
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files serving
app.use('/static', express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  etag: true
}));

// Simple test endpoint (no auth required)
app.get('/test', (req, res) => {
  res.json({
    message: 'CORS Test Successful',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Debug endpoint for TargetProcess connection
app.get('/debug/tp', async (req, res) => {
  try {
    const { getMCPClient } = require('./mcp');
    const mcpClient = getMCPClient();
    
    const result = await mcpClient.testConnection();
    
    res.json({
      success: result.success,
      error: result.error,
      config: {
        domain: process.env.TP_DOMAIN,
        hasUsername: !!process.env.TP_USERNAME,
        hasPassword: !!process.env.TP_PASSWORD,
        hasApiToken: !!process.env.TP_API_TOKEN,
        nodeEnv: process.env.NODE_ENV
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Public status endpoint (bypasses all auth)
app.get('/status', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    config: {
      domain: process.env.TP_DOMAIN,
      hasUsername: !!process.env.TP_USERNAME,
      hasPassword: !!process.env.TP_PASSWORD,
      hasApiToken: !!process.env.TP_API_TOKEN
    }
  });
});

// API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// Serve main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve embedded visualization
app.get('/embed/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'embed.html'));
});

// Debug page
app.get('/debug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'debug.html'));
});

// Initialize WebSocket server for real-time updates
const wss = new WebSocket.Server({ 
  server,
  path: '/ws',
  clientTracking: true
});

const wsManager = initializeWebSocket(wss);

// Make WebSocket manager available globally
app.locals.wsManager = wsManager;

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: err.message });
  }
  
  // Handle TargetProcess API errors
  if (err.name === 'TPServiceError') {
    return res.status(502).json({ error: 'TargetProcess service error', details: err.message });
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 TargetProcess D3.js Visualization Server running on port ${PORT}`);
  console.log(`📊 WebSocket server ready for real-time updates`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🎯 Dashboard: http://localhost:${PORT}/`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;