#!/usr/bin/env node
// Test UserStory query to debug parameter parsing error
const { TPService } = require('./src/mcp/tp-service');

async function testUserStoryQuery() {
  console.log('🔍 Testing UserStory Query...\n');
  
  const config = {
    domain: 'apptiocsgfa.tpondemand.com',
    credentials: {
      username: 'admin',
      password: 'admin'
    }
  };
  
  const tpService = new TPService(config);
  
  // Test different UserStory query configurations
  const testCases = [
    {
      name: 'Basic UserStory query (no includes)',
      params: { type: 'UserStory', take: 1 }
    },
    {
      name: 'UserStory with Epic include',
      params: { type: 'UserStory', include: ['Epic'], take: 1 }
    },
    {
      name: 'UserStory with Feature include',
      params: { type: 'UserStory', include: ['Feature'], take: 1 }
    },
    {
      name: 'UserStory with Team include',
      params: { type: 'UserStory', include: ['Team'], take: 1 }
    },
    {
      name: 'UserStory with Project include',
      params: { type: 'UserStory', include: ['Project'], take: 1 }
    },
    {
      name: 'UserStory with AssignedUser include',
      params: { type: 'UserStory', include: ['AssignedUser'], take: 1 }
    },
    {
      name: 'UserStory with multiple includes (original)',
      params: { type: 'UserStory', include: ['Epic', 'Feature', 'Team', 'Project', 'AssignedUser'], take: 1 }
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
}

testUserStoryQuery().catch(console.error);