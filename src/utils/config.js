// Configuration validation and utilities

function validateEnvironment() {
  const required = ['TP_DOMAIN'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate authentication method
  const hasApiToken = !!process.env.TP_API_TOKEN;
  const hasCredentials = !!(process.env.TP_USERNAME && process.env.TP_PASSWORD);
  
  if (!hasApiToken && !hasCredentials) {
    throw new Error('Either TP_API_TOKEN or both TP_USERNAME and TP_PASSWORD must be provided');
  }
  
  console.log('✅ Environment configuration validated');
}

function getTargetProcessConfig() {
  const config = {
    domain: process.env.TP_DOMAIN,
    retry: {
      maxRetries: 3,
      delayMs: 1000,
      backoffFactor: 2
    }
  };
  
  if (process.env.TP_API_TOKEN) {
    config.apiKey = process.env.TP_API_TOKEN;
  } else {
    config.credentials = {
      username: process.env.TP_USERNAME,
      password: process.env.TP_PASSWORD
    };
  }
  
  return config;
}

function getCacheConfig() {
  return {
    ttl: parseInt(process.env.CACHE_TTL) || 300000, // 5 minutes
    checkPeriod: 60000 // 1 minute
  };
}

function getWebSocketConfig() {
  return {
    enabled: process.env.ENABLE_REAL_TIME !== 'false',
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000,
    updateInterval: parseInt(process.env.UPDATE_INTERVAL) || 5000
  };
}

module.exports = {
  validateEnvironment,
  getTargetProcessConfig,
  getCacheConfig,
  getWebSocketConfig
};