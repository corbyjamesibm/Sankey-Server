// WebSocket server for real-time updates
const WebSocket = require('ws');
const { getWebSocketConfig } = require('../utils/config');

class WebSocketManager {
  constructor() {
    this.clients = new Map(); // Map of client connections
    this.subscriptions = new Map(); // Map of visualization subscriptions
    this.config = getWebSocketConfig();
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0
    };
  }

  initialize(wss) {
    this.wss = wss;
    
    wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Set up periodic cleanup and heartbeat
    this.setupHeartbeat();
    
    console.log('✅ WebSocket server initialized');
    return this;
  }

  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const client = {
      ws,
      subscriptions: new Set(),
      connectedAt: new Date(),
      lastPing: new Date(),
      userAgent: req.headers['user-agent'],
      ip: req.connection.remoteAddress
    };

    this.clients.set(clientId, client);
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    console.log(`WebSocket client connected: ${clientId} (${this.stats.activeConnections} active)`);

    // Set up event handlers
    ws.on('message', (message) => {
      this.handleMessage(clientId, message);
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnect(clientId, code, reason);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.stats.errors++;
      this.handleDisconnect(clientId);
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastPing = new Date();
      }
    });

    // Send welcome message
    this.sendMessage(clientId, {
      type: 'connected',
      clientId,
      serverTime: new Date().toISOString(),
      heartbeatInterval: this.config.heartbeatInterval
    });
  }

  handleMessage(clientId, message) {
    this.stats.messagesReceived++;
    
    try {
      const data = JSON.parse(message);
      this.processMessage(clientId, data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      this.sendError(clientId, 'Invalid message format');
    }
  }

  processMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (data.type) {
      case 'subscribe':
        this.subscribe(clientId, data.visualizationId);
        break;
      
      case 'unsubscribe':
        this.unsubscribe(clientId, data.visualizationId);
        break;
      
      case 'ping':
        this.sendMessage(clientId, { 
          type: 'pong', 
          timestamp: new Date().toISOString() 
        });
        break;
      
      case 'get_stats':
        this.sendMessage(clientId, {
          type: 'stats',
          stats: this.getPublicStats()
        });
        break;
      
      default:
        console.warn(`Unknown message type from ${clientId}: ${data.type}`);
        this.sendError(clientId, 'Unknown message type');
    }
  }

  subscribe(clientId, visualizationId) {
    if (!visualizationId) {
      this.sendError(clientId, 'Visualization ID is required');
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) return;

    // Add to client's subscriptions
    client.subscriptions.add(visualizationId);

    // Add to global subscriptions
    if (!this.subscriptions.has(visualizationId)) {
      this.subscriptions.set(visualizationId, new Set());
    }
    this.subscriptions.get(visualizationId).add(clientId);

    console.log(`Client ${clientId} subscribed to visualization ${visualizationId}`);

    // Send confirmation
    this.sendMessage(clientId, {
      type: 'subscribed',
      visualizationId,
      timestamp: new Date().toISOString()
    });
  }

  unsubscribe(clientId, visualizationId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from client's subscriptions
    client.subscriptions.delete(visualizationId);

    // Remove from global subscriptions
    if (this.subscriptions.has(visualizationId)) {
      this.subscriptions.get(visualizationId).delete(clientId);
      
      // Clean up empty subscription
      if (this.subscriptions.get(visualizationId).size === 0) {
        this.subscriptions.delete(visualizationId);
      }
    }

    console.log(`Client ${clientId} unsubscribed from visualization ${visualizationId}`);

    // Send confirmation
    this.sendMessage(clientId, {
      type: 'unsubscribed',
      visualizationId,
      timestamp: new Date().toISOString()
    });
  }

  handleDisconnect(clientId, code, reason) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`WebSocket client disconnected: ${clientId} (code: ${code}, reason: ${reason})`);
    
    this.stats.activeConnections--;

    // Clean up subscriptions
    client.subscriptions.forEach(visualizationId => {
      if (this.subscriptions.has(visualizationId)) {
        this.subscriptions.get(visualizationId).delete(clientId);
        
        // Clean up empty subscription
        if (this.subscriptions.get(visualizationId).size === 0) {
          this.subscriptions.delete(visualizationId);
        }
      }
    });

    // Remove client
    this.clients.delete(clientId);
  }

  broadcastUpdate(visualizationId, data) {
    const subscribers = this.subscriptions.get(visualizationId);
    if (!subscribers || subscribers.size === 0) {
      console.log(`No subscribers for visualization ${visualizationId}`);
      return;
    }

    const message = {
      type: 'visualization_update',
      visualizationId,
      data,
      timestamp: new Date().toISOString()
    };

    let successCount = 0;
    let errorCount = 0;

    subscribers.forEach(clientId => {
      try {
        const sent = this.sendMessage(clientId, message);
        if (sent) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error sending update to client ${clientId}:`, error);
        errorCount++;
      }
    });

    console.log(`Broadcast update for visualization ${visualizationId}: ${successCount} successful, ${errorCount} errors`);
  }

  sendMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(data));
      this.stats.messagesSent++;
      return true;
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  sendError(clientId, message) {
    this.sendMessage(clientId, {
      type: 'error',
      message,
      timestamp: new Date().toISOString()
    });
  }

  setupHeartbeat() {
    if (!this.config.enabled) return;

    setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          // Send ping to keep connection alive
          client.ws.ping();
          
          // Check if client is still responsive
          const timeSinceLastPing = Date.now() - client.lastPing.getTime();
          if (timeSinceLastPing > this.config.heartbeatInterval * 2) {
            console.log(`Client ${clientId} appears unresponsive, closing connection`);
            client.ws.close(1000, 'Heartbeat timeout');
          }
        } else {
          // Clean up dead connections
          this.handleDisconnect(clientId);
        }
      });
    }, this.config.heartbeatInterval);
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats() {
    return {
      ...this.stats,
      activeConnections: this.clients.size,
      activeSubscriptions: this.subscriptions.size,
      totalSubscriptions: Array.from(this.subscriptions.values())
        .reduce((sum, set) => sum + set.size, 0),
      timestamp: new Date().toISOString()
    };
  }

  getPublicStats() {
    return {
      activeConnections: this.clients.size,
      activeSubscriptions: this.subscriptions.size,
      totalSubscriptions: Array.from(this.subscriptions.values())
        .reduce((sum, set) => sum + set.size, 0),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  // Health check
  isHealthy() {
    return {
      healthy: true,
      stats: this.getStats(),
      config: {
        enabled: this.config.enabled,
        heartbeatInterval: this.config.heartbeatInterval
      }
    };
  }

  // Shutdown gracefully
  shutdown() {
    console.log('Shutting down WebSocket server...');
    
    this.clients.forEach((client, clientId) => {
      this.sendMessage(clientId, {
        type: 'server_shutdown',
        message: 'Server is shutting down',
        timestamp: new Date().toISOString()
      });
      client.ws.close(1000, 'Server shutdown');
    });

    this.clients.clear();
    this.subscriptions.clear();
    
    if (this.wss) {
      this.wss.close();
    }
  }
}

// Global WebSocket manager instance
let wsManager = null;

function initializeWebSocket(wss) {
  wsManager = new WebSocketManager();
  return wsManager.initialize(wss);
}

function getWebSocketManager() {
  return wsManager;
}

module.exports = {
  initializeWebSocket,
  getWebSocketManager,
  WebSocketManager
};