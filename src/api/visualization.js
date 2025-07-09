// Visualization API endpoints
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const path = require('path');
const NodeCache = require('node-cache');

const { getMCPClient } = require('../mcp');
const { transformToSankey } = require('../transformers');
const { getCacheConfig } = require('../utils/config');

const router = express.Router();
const cacheConfig = getCacheConfig();
const cache = new NodeCache({ 
  stdTTL: cacheConfig.ttl / 1000, // Convert to seconds
  checkperiod: cacheConfig.checkPeriod / 1000
});

// Validation schemas
const createSankeySchema = Joi.object({
  title: Joi.string().required().min(1).max(100),
  subtitle: Joi.string().optional().allow('').max(200),
  dataQuery: Joi.object({
    type: Joi.string().optional().default('Portfolio'),
    include: Joi.array().items(Joi.string()).optional().default(['Epics', 'UserStories', 'Teams']),
    where: Joi.string().optional(),
    take: Joi.number().optional().min(1).max(1000).default(100)
  }).optional().default({}),
  theme: Joi.string().valid('targetprocess', 'default').default('targetprocess')
});

const updateVisualizationSchema = Joi.object({
  title: Joi.string().optional().min(1).max(100),
  subtitle: Joi.string().optional().allow('').max(200),
  theme: Joi.string().valid('targetprocess', 'default').optional()
});

// Create Sankey visualization
router.post('/sankey', async (req, res) => {
  try {
    const { error, value } = createSankeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const { title, subtitle, dataQuery, theme } = value;
    const visualizationId = uuidv4();

    console.log(`Creating Sankey visualization: ${title}`);

    // Get MCP client and fetch data
    const mcpClient = getMCPClient();
    const rawData = await mcpClient.getPortfolioFlowData();
    
    // Transform data to Sankey format
    const sankeyData = transformToSankey(rawData, { title, subtitle, theme });
    
    // Create visualization record
    const visualization = {
      id: visualizationId,
      type: 'sankey',
      title,
      subtitle,
      theme,
      data: sankeyData,
      dataQuery,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Cache the visualization
    cache.set(visualizationId, visualization);

    console.log(`Sankey visualization created successfully: ${visualizationId}`);

    res.json({
      id: visualizationId,
      type: 'sankey',
      title,
      subtitle,
      theme,
      status: 'created',
      createdAt: visualization.createdAt,
      data: sankeyData
    });

  } catch (err) {
    console.error('Error creating Sankey visualization:', err);
    
    if (err.name === 'TPServiceError') {
      return res.status(502).json({ 
        error: 'TargetProcess service error', 
        details: err.message 
      });
    }

    res.status(500).json({ 
      error: 'Failed to create visualization',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get visualization by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const embed = req.query.embed === 'true';
  
  const visualization = cache.get(id);
  if (!visualization) {
    return res.status(404).json({ error: 'Visualization not found' });
  }

  if (embed) {
    // Return HTML for embedding
    const html = generateVisualizationHTML(visualization);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } else {
    // Return JSON data
    res.json(visualization);
  }
});

// Update visualization
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateVisualizationSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const visualization = cache.get(id);
    if (!visualization) {
      return res.status(404).json({ error: 'Visualization not found' });
    }

    console.log(`Updating visualization: ${id}`);

    // Get MCP client and refresh data
    const mcpClient = getMCPClient();
    const rawData = await mcpClient.getPortfolioFlowData();
    
    // Use updated values or keep existing ones
    const updatedTitle = value.title || visualization.title;
    const updatedSubtitle = value.subtitle !== undefined ? value.subtitle : visualization.subtitle;
    const updatedTheme = value.theme || visualization.theme;

    // Transform updated data
    const sankeyData = transformToSankey(rawData, {
      title: updatedTitle,
      subtitle: updatedSubtitle,
      theme: updatedTheme
    });

    // Update visualization record
    const updatedVisualization = {
      ...visualization,
      title: updatedTitle,
      subtitle: updatedSubtitle,
      theme: updatedTheme,
      data: sankeyData,
      updatedAt: new Date().toISOString()
    };

    // Update cache
    cache.set(id, updatedVisualization);

    // Broadcast update to WebSocket clients
    if (req.app.locals.wsManager) {
      req.app.locals.wsManager.broadcastUpdate(id, sankeyData);
    }

    console.log(`Visualization updated successfully: ${id}`);

    res.json(updatedVisualization);

  } catch (err) {
    console.error('Error updating visualization:', err);
    
    if (err.name === 'TPServiceError') {
      return res.status(502).json({ 
        error: 'TargetProcess service error', 
        details: err.message 
      });
    }

    res.status(500).json({ 
      error: 'Failed to update visualization',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Delete visualization
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const deleted = cache.del(id);
  
  if (deleted) {
    console.log(`Visualization deleted: ${id}`);
    res.json({ message: 'Visualization deleted successfully' });
  } else {
    res.status(404).json({ error: 'Visualization not found' });
  }
});

// List all visualizations
router.get('/', (req, res) => {
  const keys = cache.keys();
  const visualizations = keys.map(key => {
    const viz = cache.get(key);
    if (!viz) return null;
    
    return {
      id: viz.id,
      type: viz.type,
      title: viz.title,
      subtitle: viz.subtitle,
      theme: viz.theme,
      createdAt: viz.createdAt,
      updatedAt: viz.updatedAt
    };
  }).filter(Boolean);
  
  res.json({ 
    visualizations,
    total: visualizations.length,
    timestamp: new Date().toISOString()
  });
});

// WebSocket stream endpoint info
router.get('/:id/stream', (req, res) => {
  const { id } = req.params;
  
  const visualization = cache.get(id);
  if (!visualization) {
    return res.status(404).json({ error: 'Visualization not found' });
  }

  res.json({
    message: 'WebSocket stream available',
    visualizationId: id,
    endpoint: `/ws`,
    instructions: 'Connect to WebSocket and send: {"type": "subscribe", "visualizationId": "' + id + '"}'
  });
});

// Test endpoint for development
router.get('/test/connection', async (req, res) => {
  try {
    const mcpClient = getMCPClient();
    const result = await mcpClient.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Generate HTML for visualization embedding
function generateVisualizationHTML(visualization) {
  const { data, title, subtitle, theme } = visualization;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script src="https://unpkg.com/d3-sankey@0.12.3/dist/d3-sankey.min.js"></script>
    <link rel="stylesheet" href="/static/css/visualization.css">
</head>
<body>
    <div id="visualization-container">
        <div class="visualization-header">
            <h1 class="visualization-title">${title}</h1>
            ${subtitle ? `<div class="visualization-subtitle">${subtitle}</div>` : ''}
            <div class="real-time-indicator">Real-time</div>
        </div>
        
        <div class="stats-container">
            ${data.metadata.stats.map(stat => `
                <div class="stat-box">
                    <span class="stat-value">${stat.value}</span>
                    <span class="stat-label">${stat.label}</span>
                </div>
            `).join('')}
        </div>

        <div class="chart-container">
            <div class="level-labels">
                <div class="level-label">Portfolios</div>
                <div class="level-label">Epics</div>
                <div class="level-label">Work Allocations</div>
                <div class="level-label">Teams</div>
            </div>
            <div id="sankey-chart"></div>
        </div>

        <div class="legend">
            <div class="legend-title">Visualization Legend</div>
            ${data.styling.legend.sections.map(section => `
                <div class="legend-section">
                    <div class="legend-section-title">${section.title}</div>
                    ${section.items.map(item => `
                        <div class="legend-item">
                            <span class="legend-color" style="background-color: ${item.color};"></span>
                            ${item.label}
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
    </div>

    <script>
        window.visualizationData = ${JSON.stringify(data)};
        window.visualizationId = "${visualization.id}";
        window.visualizationTheme = "${theme}";
    </script>
    <script src="/static/js/sankey-renderer.js"></script>
    <script src="/static/js/websocket-client.js"></script>
</body>
</html>`;
}

module.exports = router;