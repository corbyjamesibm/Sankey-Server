// API Routes - Main router for all API endpoints
const express = require('express');
const router = express.Router();

const visualizationRoutes = require('./visualization');
const configRoutes = require('./config');
const healthRoutes = require('./health');

// Mount routes
router.use('/visualizations', visualizationRoutes);
router.use('/config', configRoutes);
router.use('/health', healthRoutes);

// API status endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'TargetProcess D3.js Visualization Server API',
    version: '1.0.0',
    status: 'active',
    timestamp: new Date().toISOString(),
    endpoints: {
      visualizations: '/api/visualizations',
      config: '/api/config',
      health: '/api/health'
    }
  });
});

module.exports = router;