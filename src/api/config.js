// Configuration API endpoints
const express = require('express');
const Joi = require('joi');

const router = express.Router();

// TargetProcess theme configuration
const targetProcessTheme = {
  colors: {
    portfolio_ai: '#3498db',
    portfolio_transform: '#2980b9',
    portfolio_cloud: '#1abc9c',
    portfolio_default: '#34495e',
    epic_ai: '#9b59b6',
    epic_transform: '#16a085',
    epic_cloud: '#27ae60',
    epic_test: '#95a5a6',
    epic_default: '#7f8c8d',
    work_ai: '#e74c3c',
    work_transform: '#e67e22',
    work_infra: '#f39c12',
    work_test: '#f1c40f',
    work_default: '#bdc3c7',
    team_premium: '#8e44ad',
    team_high: '#d35400',
    team_mid: '#f39c12',
    team_standard: '#2ecc71'
  },
  typography: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    fontSize: {
      title: '2.5em',
      subtitle: '1.2em',
      label: '11px',
      tooltip: '12px'
    }
  },
  layout: {
    margin: { top: 40, right: 40, bottom: 40, left: 40 },
    nodeWidth: 18,
    nodePadding: 10
  }
};

const defaultTheme = {
  colors: {
    primary: '#1f77b4',
    secondary: '#ff7f0e',
    tertiary: '#2ca02c',
    quaternary: '#d62728'
  },
  typography: {
    fontFamily: "Arial, sans-serif",
    fontSize: {
      title: '2em',
      subtitle: '1.1em',
      label: '12px',
      tooltip: '11px'
    }
  },
  layout: {
    margin: { top: 30, right: 30, bottom: 30, left: 30 },
    nodeWidth: 15,
    nodePadding: 8
  }
};

// Validation schema
const configUpdateSchema = Joi.object({
  colors: Joi.object().pattern(
    Joi.string(),
    Joi.string().pattern(/^#[0-9A-F]{6}$/i)
  ).optional(),
  typography: Joi.object({
    fontFamily: Joi.string().optional(),
    fontSize: Joi.object().optional()
  }).optional(),
  layout: Joi.object({
    margin: Joi.object({
      top: Joi.number().min(0).max(100).optional(),
      right: Joi.number().min(0).max(100).optional(),
      bottom: Joi.number().min(0).max(100).optional(),
      left: Joi.number().min(0).max(100).optional()
    }).optional(),
    nodeWidth: Joi.number().min(5).max(50).optional(),
    nodePadding: Joi.number().min(2).max(20).optional()
  }).optional()
});

// Get configuration for visualization
router.get('/:visualizationId', (req, res) => {
  const { visualizationId } = req.params;
  const { theme = 'targetprocess' } = req.query;
  
  const config = theme === 'targetprocess' ? targetProcessTheme : defaultTheme;
  
  res.json({
    visualizationId,
    theme,
    config,
    timestamp: new Date().toISOString()
  });
});

// Update configuration (Phase 2 feature)
router.post('/:visualizationId', (req, res) => {
  const { visualizationId } = req.params;
  const { error, value } = configUpdateSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: error.details[0].message 
    });
  }

  // For MVP, return the merged theme configuration
  // In Phase 2, this would update and persist custom configurations
  const baseConfig = targetProcessTheme;
  const mergedConfig = {
    ...baseConfig,
    ...value,
    colors: { ...baseConfig.colors, ...(value.colors || {}) },
    typography: { ...baseConfig.typography, ...(value.typography || {}) },
    layout: { ...baseConfig.layout, ...(value.layout || {}) }
  };

  res.json({
    visualizationId,
    message: 'Configuration updated successfully',
    config: mergedConfig,
    timestamp: new Date().toISOString()
  });
});

// Get available themes
router.get('/', (req, res) => {
  res.json({
    themes: [
      {
        id: 'targetprocess',
        name: 'TargetProcess',
        description: 'Default TargetProcess styling and colors',
        config: targetProcessTheme
      },
      {
        id: 'default',
        name: 'Default',
        description: 'Standard D3.js styling',
        config: defaultTheme
      }
    ],
    timestamp: new Date().toISOString()
  });
});

// Get theme by ID
router.get('/themes/:themeId', (req, res) => {
  const { themeId } = req.params;
  
  let theme;
  switch (themeId) {
    case 'targetprocess':
      theme = {
        id: 'targetprocess',
        name: 'TargetProcess',
        description: 'Default TargetProcess styling and colors',
        config: targetProcessTheme
      };
      break;
    case 'default':
      theme = {
        id: 'default',
        name: 'Default',
        description: 'Standard D3.js styling',
        config: defaultTheme
      };
      break;
    default:
      return res.status(404).json({ error: 'Theme not found' });
  }

  res.json({
    theme,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;