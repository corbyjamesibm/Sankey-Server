#!/usr/bin/env node
// Debug the exact URL being constructed
const { TPService } = require('./src/mcp/tp-service');

const config = {
  domain: 'apptiocsgfa.tpondemand.com',
  credentials: {
    username: 'admin',
    password: 'admin'
  }
};

const tpService = new TPService(config);

// Test the URL construction
console.log('🔍 URL Construction Debug\n');

// Test buildWhereClause
const whereResult = tpService.buildWhereClause({});
console.log('Where clause:', whereResult);

// Test buildIncludeClause  
const includeResult = tpService.buildIncludeClause([]);
console.log('Include clause:', includeResult);

// Test buildOrderByClause
const orderByResult = tpService.buildOrderByClause([]);
console.log('OrderBy clause:', orderByResult);

// Simulate the URL that would be constructed
const type = 'Project';
const where = '';
const include = [];
const orderBy = [];
const take = 1;

const whereClause = where ? `?where=${encodeURIComponent(where)}` : '?';
const includeClause = tpService.buildIncludeClause(include);
const orderByClause = tpService.buildOrderByClause(orderBy);
const takeClause = `&take=${take}`;
const formatClause = `&format=json`;

const url = `${tpService.baseUrl}/${type}${whereClause}${includeClause}${orderByClause}${takeClause}${formatClause}`;

console.log('\n📋 Final URL:', url);
console.log('Base URL:', tpService.baseUrl);

// Test the actual HTTP request
const fetch = require('node-fetch');
const auth = Buffer.from(`${config.credentials.username}:${config.credentials.password}`).toString('base64');

async function testRequest() {
  try {
    console.log('\n🔄 Testing actual request...');
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'TargetProcess-D3-Visualization-Server/1.0.0'
      }
    });
    
    console.log(`Response: ${response.status} ${response.statusText}`);
    console.log('Headers:', Object.fromEntries(response.headers));
    
    const text = await response.text();
    console.log('Response text (first 500 chars):', text.substring(0, 500));
    
  } catch (error) {
    console.log('Request error:', error.message);
  }
}

testRequest();