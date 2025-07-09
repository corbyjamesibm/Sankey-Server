// MCP Client - Main interface for TargetProcess integration
const { TPService } = require('./tp-service');
const { getTargetProcessConfig } = require('../utils/config');

class MCPClient {
  constructor(config) {
    this.tpService = new TPService(config);
    this.config = config;
  }

  async searchEntities(query) {
    const {
      type,
      where,
      include = [],
      orderBy = [],
      take = 100
    } = query;

    try {
      const result = await this.tpService.searchEntities({
        type,
        where,
        include,
        orderBy,
        take
      });

      return result;
    } catch (error) {
      console.error('MCP Client search error:', error);
      throw error;
    }
  }

  async getEntity(type, id, include = []) {
    try {
      const result = await this.tpService.getEntity(type, id, include);
      return result;
    } catch (error) {
      console.error('MCP Client get error:', error);
      throw error;
    }
  }

  async createEntity(type, data) {
    try {
      const result = await this.tpService.createEntity(type, data);
      return result;
    } catch (error) {
      console.error('MCP Client create error:', error);
      throw error;
    }
  }

  async updateEntity(type, id, data) {
    try {
      const result = await this.tpService.updateEntity(type, id, data);
      return result;
    } catch (error) {
      console.error('MCP Client update error:', error);
      throw error;
    }
  }

  async getPortfolioFlowData() {
    try {
      const result = await this.tpService.getPortfolioFlowData();
      return result;
    } catch (error) {
      console.error('Error fetching portfolio flow data:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const result = await this.tpService.testConnection();
      return result;
    } catch (error) {
      console.error('Error testing connection:', error);
      return { success: false, error: error.message };
    }
  }

  // Method for getting sample data structure
  async getSampleData() {
    try {
      // Get a small sample of each entity type for testing
      const [portfolios, epics, userStories, teams] = await Promise.all([
        this.tpService.searchEntities({ type: 'Portfolio', take: 3 }),
        this.tpService.searchEntities({ type: 'Epic', take: 5 }),
        this.tpService.searchEntities({ type: 'UserStory', take: 10 }),
        this.tpService.searchEntities({ type: 'Team', take: 5 })
      ]);

      return {
        portfolios,
        epics,
        userStories,
        teams
      };
    } catch (error) {
      console.error('Error fetching sample data:', error);
      throw error;
    }
  }
}

// Global client instance
let mcpClient = null;

function createMCPClient(config) {
  if (!config) {
    throw new Error('MCP client configuration is required');
  }

  mcpClient = new MCPClient(config);
  return mcpClient;
}

function getMCPClient() {
  if (!mcpClient) {
    const config = getTargetProcessConfig();
    mcpClient = new MCPClient(config);
  }

  return mcpClient;
}

// Initialize client on startup
function initializeMCPClient() {
  try {
    const config = getTargetProcessConfig();
    mcpClient = new MCPClient(config);
    console.log('✅ MCP Client initialized successfully');
    return mcpClient;
  } catch (error) {
    console.error('❌ Failed to initialize MCP Client:', error.message);
    throw error;
  }
}

module.exports = {
  MCPClient,
  createMCPClient,
  getMCPClient,
  initializeMCPClient
};