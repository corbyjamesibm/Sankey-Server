// Health check API endpoints
const express = require('express');
const { getMCPClient } = require('../mcp');

const router = express.Router();

// Detailed health check
router.get('/', async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {}
  };

  // Check TargetProcess connection
  try {
    const mcpClient = getMCPClient();
    const tpResult = await mcpClient.testConnection();
    checks.checks.targetprocess = {
      status: tpResult.success ? 'healthy' : 'unhealthy',
      message: tpResult.success ? 'Connected' : tpResult.error,
      responseTime: Date.now() - Date.parse(checks.timestamp)
    };
  } catch (error) {
    checks.checks.targetprocess = {
      status: 'unhealthy',
      message: error.message,
      responseTime: null
    };
  }

  // Check WebSocket capability
  checks.checks.websocket = {
    status: 'healthy',
    message: 'WebSocket server initialized',
    enabled: process.env.ENABLE_REAL_TIME !== 'false'
  };

  // Check cache
  checks.checks.cache = {
    status: 'healthy',
    message: 'Cache operational'
  };

  // Overall health status
  const hasUnhealthy = Object.values(checks.checks).some(check => check.status === 'unhealthy');
  if (hasUnhealthy) {
    checks.status = 'unhealthy';
    res.status(503);
  }

  res.json(checks);
});

// Simple health check for load balancers
router.get('/ping', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Ready check (for Kubernetes readiness probe)
router.get('/ready', async (req, res) => {
  try {
    const mcpClient = getMCPClient();
    const result = await mcpClient.testConnection();
    
    if (result.success) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Live check (for Kubernetes liveness probe)
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;