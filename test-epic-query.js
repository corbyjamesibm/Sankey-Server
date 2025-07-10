#!/usr/bin/env node
// Test Epic query to debug parameter parsing error
const { TPService } = require('./src/mcp/tp-service');

async function testEpicQuery() {
  console.log('🔍 Testing Epic Query...\n');
  
  const config = {
    domain: 'apptiocsgfa.tpondemand.com',
    credentials: {
      username: 'admin',
      password: 'admin'
    }
  };
  
  const tpService = new TPService(config);
  
  // Test different Epic query configurations
  const testCases = [
    {
      name: 'Basic Epic query (no includes)',
      params: { type: 'Epic', take: 1 }
    },
    {
      name: 'Epic with Project include',
      params: { type: 'Epic', include: ['Project'], take: 1 }
    },
    {
      name: 'Epic with UserStories include',
      params: { type: 'Epic', include: ['UserStories'], take: 1 }
    },
    {
      name: 'Epic with Features include',
      params: { type: 'Epic', include: ['Features'], take: 1 }
    },
    {
      name: 'Epic with multiple includes (original)',
      params: { type: 'Epic', include: ['Project', 'UserStories', 'Features'], take: 1 }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`🔄 Testing: ${testCase.name}`);
    
    try {
      const response = await tpService.searchEntities(testCase.params);
      console.log(`✅ Success: Found ${response?.Items?.length || 0} items`);
      
      if (response?.Items?.length > 0) {
        const sample = response.Items[0];
        console.log(`   Sample: ${sample.Name} (ID: ${sample.Id})`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      
      if (error.statusCode === 400) {
        console.log('   → Parameter parsing error - likely invalid include field');
      }
    }
    console.log('');
  }
  
  // Test URL construction
  console.log('🔍 URL Construction Test:');
  const includeClause = tpService.buildIncludeClause(['Project', 'UserStories', 'Features']);
  console.log(`Include clause: ${includeClause}`);
  
  const testUrl = `${tpService.baseUrl}/Epic?take=1&format=json${includeClause}`;
  console.log(`Test URL: ${testUrl}`);
}

testEpicQuery().catch(console.error);