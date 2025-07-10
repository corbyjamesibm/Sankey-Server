// TargetProcess Service - JavaScript implementation of the MCP client
const fetch = require('node-fetch');
const { setTimeout } = require('timers/promises');

class TPServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'TPServiceError';
    this.statusCode = statusCode;
  }
}

class TPService {
  constructor(config) {
    this.baseUrl = `https://${config.domain}/api/v1`;
    this.retryConfig = config.retry || {
      maxRetries: 3,
      delayMs: 1000,
      backoffFactor: 2
    };

    if (config.apiKey) {
      this.auth = config.apiKey;
      this.authType = 'apikey';
    } else if (config.credentials) {
      this.auth = Buffer.from(`${config.credentials.username}:${config.credentials.password}`).toString('base64');
      this.authType = 'basic';
    } else {
      throw new Error('Either apiKey or credentials must be provided');
    }
  }

  formatWhereValue(value) {
    if (value === null) {
      return 'null';
    }

    if (typeof value === 'boolean') {
      return value.toString().toLowerCase();
    }

    if (value instanceof Date) {
      return `'${value.toISOString().split('T')[0]}'`;
    }

    if (Array.isArray(value)) {
      return `[${value.map(v => this.formatWhereValue(v)).join(',')}]`;
    }

    const strValue = String(value);
    const unquoted = strValue.replace(/^['"]|['"]$/g, '');
    const escaped = unquoted.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  formatWhereField(field) {
    if (field.startsWith('CustomField.')) {
      return `cf_${field.substring(12)}`;
    }
    return field.replace(/\s+/g, '');
  }

  buildWhereClause(conditions) {
    if (!conditions || typeof conditions !== 'object') {
      return '';
    }

    const clauses = [];
    for (const [field, value] of Object.entries(conditions)) {
      const formattedField = this.formatWhereField(field);
      const formattedValue = this.formatWhereValue(value);
      clauses.push(`${formattedField}=${formattedValue}`);
    }

    return clauses.length > 0 ? `?where=${encodeURIComponent(clauses.join(' and '))}` : '';
  }

  buildIncludeClause(include) {
    if (!include || !Array.isArray(include) || include.length === 0) {
      return '';
    }

    const validIncludes = include.filter(inc => typeof inc === 'string' && inc.trim().length > 0);
    return validIncludes.length > 0 ? `&include=[${validIncludes.join(',')}]` : '';
  }

  buildOrderByClause(orderBy) {
    if (!orderBy || !Array.isArray(orderBy) || orderBy.length === 0) {
      return '';
    }

    const validOrderBy = orderBy.filter(order => typeof order === 'string' && order.trim().length > 0);
    return validOrderBy.length > 0 ? `&orderBy=${validOrderBy.join(',')}` : '';
  }

  async executeWithRetry(operation, context) {
    let lastError = null;
    let delay = this.retryConfig.delayMs;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on client errors
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        await setTimeout(delay);
        delay *= this.retryConfig.backoffFactor;
      }
    }

    throw new TPServiceError(
      `Failed to ${context} after ${this.retryConfig.maxRetries} attempts: ${lastError?.message}`,
      lastError?.statusCode || 500
    );
  }

  async extractErrorMessage(response) {
    try {
      const data = await response.json();
      return data.Message || data.ErrorMessage || data.Description || response.statusText;
    } catch {
      return response.statusText;
    }
  }

  async handleApiResponse(response, context) {
    if (!response.ok) {
      const errorMessage = await this.extractErrorMessage(response);
      throw new TPServiceError(
        `${context} failed: ${response.status} - ${errorMessage}`,
        response.status
      );
    }
    return await response.json();
  }

  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'TargetProcess-D3-Visualization-Server/1.0.0'
    };

    if (this.authType === 'apikey') {
      headers['Authorization'] = `Bearer ${this.auth}`;
    } else {
      headers['Authorization'] = `Basic ${this.auth}`;
    }

    return headers;
  }

  async searchEntities(params) {
    const { type, where, include = [], orderBy = [], take = 100 } = params;

    const operation = async () => {
      let queryParams = [`take=${take}`, `format=json`];
      
      if (where) {
        if (typeof where === 'string') {
          queryParams.push(`where=${encodeURIComponent(where)}`);
        } else {
          const whereClause = this.buildWhereClause(where);
          if (whereClause) {
            queryParams.push(whereClause.substring(1)); // Remove the leading '?'
          }
        }
      }
      
      const includeClause = this.buildIncludeClause(include);
      if (includeClause) {
        queryParams.push(includeClause.substring(1)); // Remove the leading '&'
      }
      
      const orderByClause = this.buildOrderByClause(orderBy);
      if (orderByClause) {
        queryParams.push(orderByClause.substring(1)); // Remove the leading '&'
      }

      const url = `${this.baseUrl}/${type}?${queryParams.join('&')}`;
      const headers = this.getAuthHeaders();

      const response = await fetch(url, { headers });
      return this.handleApiResponse(response, `Search ${type} entities`);
    };

    return this.executeWithRetry(operation, `search ${type} entities`);
  }

  async getEntity(type, id, include = []) {
    const operation = async () => {
      let queryParams = [`format=json`];
      
      const includeClause = this.buildIncludeClause(include);
      if (includeClause) {
        queryParams.push(includeClause.substring(1)); // Remove the leading '&'
      }
      
      const url = `${this.baseUrl}/${type}/${id}?${queryParams.join('&')}`;
      const headers = this.getAuthHeaders();

      const response = await fetch(url, { headers });
      return this.handleApiResponse(response, `Get ${type} entity`);
    };

    return this.executeWithRetry(operation, `get ${type} entity`);
  }

  async createEntity(type, data) {
    const operation = async () => {
      const url = `${this.baseUrl}/${type}`;
      const headers = this.getAuthHeaders();

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });

      return this.handleApiResponse(response, `Create ${type} entity`);
    };

    return this.executeWithRetry(operation, `create ${type} entity`);
  }

  async updateEntity(type, id, data) {
    const operation = async () => {
      const url = `${this.baseUrl}/${type}/${id}`;
      const headers = this.getAuthHeaders();

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });

      return this.handleApiResponse(response, `Update ${type} entity`);
    };

    return this.executeWithRetry(operation, `update ${type} entity`);
  }

  // Specialized method for getting portfolio flow data
  async getPortfolioFlowData() {
    try {
      console.log('Fetching portfolio flow data...');
      
      // Fetch projects (acting as portfolios in this system)
      const portfolios = await this.searchEntities({
        type: 'Project',
        include: ['Epics', 'UserStories'],
        take: 50
      });

      console.log(`Found ${portfolios?.Items?.length || 0} projects (portfolios)`);

      // Fetch portfolio epics if they exist
      let portfolioEpics = null;
      try {
        portfolioEpics = await this.searchEntities({
          type: 'PortfolioEpic',
          include: ['Project', 'Epics'],
          take: 100
        });
        console.log(`Found ${portfolioEpics?.Items?.length || 0} portfolio epics`);
      } catch (error) {
        console.log('Portfolio epics not available or empty');
      }

      // Fetch epics with their assignments (excluding UserStories - causes 400 error)
      const epics = await this.searchEntities({
        type: 'Epic',
        include: ['Project', 'Features'],
        take: 100
      });

      console.log(`Found ${epics?.Items?.length || 0} epics`);

      // Fetch features  
      const features = await this.searchEntities({
        type: 'Feature',
        include: ['Epic', 'Project', 'UserStories'],
        take: 200
      });

      console.log(`Found ${features?.Items?.length || 0} features`);

      // Fetch user stories with team assignments (excluding Epic - causes 400 error)
      const userStories = await this.searchEntities({
        type: 'UserStory',
        include: ['Feature', 'Team', 'Project', 'AssignedUser'],
        take: 500
      });

      console.log(`Found ${userStories?.Items?.length || 0} user stories`);

      // Fetch teams (excluding Members - causes 400 error)
      const teams = await this.searchEntities({
        type: 'Team',
        take: 50
      });

      console.log(`Found ${teams?.Items?.length || 0} teams`);

      return {
        portfolios, // These are actually Projects acting as portfolios
        portfolioEpics,
        epics,
        features,
        userStories,
        teams
      };
    } catch (error) {
      console.error('Error fetching portfolio flow data:', error);
      throw error;
    }
  }

  // Test connection method
  async testConnection() {
    try {
      const response = await this.searchEntities({
        type: 'Project',
        take: 1
      });
      return { 
        success: true, 
        data: response,
        count: response?.Items?.length || 0,
        message: `Found ${response?.Items?.length || 0} project(s)`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = { TPService, TPServiceError };