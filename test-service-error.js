#!/usr/bin/env node
// Test script to reproduce the TargetProcess service error
const { getMCPClient } = require('./src/mcp');

async function testServiceError() {
  console.log('🔍 Testing TargetProcess Service Error...\n');
  
  // Set environment variables
  process.env.TP_DOMAIN = 'apptiocsgfa.tpondemand.com';
  process.env.TP_USERNAME = 'admin';
  process.env.TP_PASSWORD = 'admin';
  process.env.NODE_ENV = 'production';
  
  try {
    console.log('🔄 Creating MCP client...');
    const mcpClient = getMCPClient();
    
    console.log('🔄 Testing connection...');
    const result = await mcpClient.testConnection();
    
    if (result.success) {
      console.log('✅ Connection successful!');
      console.log(`   ${result.message}`);
      
      // Test portfolio flow data
      console.log('\n🔄 Testing portfolio flow data...');
      const portfolioData = await mcpClient.getPortfolioFlowData();
      console.log('✅ Portfolio data retrieved successfully');
      console.log(`   Portfolios: ${portfolioData.portfolios?.Items?.length || 0}`);
      console.log(`   Epics: ${portfolioData.epics?.Items?.length || 0}`);
      console.log(`   User Stories: ${portfolioData.userStories?.Items?.length || 0}`);
      console.log(`   Teams: ${portfolioData.teams?.Items?.length || 0}`);
      
      // Test sample data
      console.log('\n🔄 Testing sample data...');
      const sampleData = await mcpClient.getSampleData();
      console.log('✅ Sample data retrieved successfully');
      
    } else {
      console.log('❌ Connection failed!');
      console.log(`   Error: ${result.error}`);
    }
    
  } catch (error) {
    console.log('❌ Service error occurred:');
    console.log(`   Message: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
    
    // Check if it's a specific type of error
    if (error.message.includes('401')) {
      console.log('\n🔧 Diagnosis: Authentication error');
      console.log('   - Check credentials in environment variables');
      console.log('   - Verify account has API access');
    } else if (error.message.includes('404')) {
      console.log('\n🔧 Diagnosis: Endpoint not found');
      console.log('   - Check API URL construction');
      console.log('   - Verify entity types exist');
    } else if (error.message.includes('timeout')) {
      console.log('\n🔧 Diagnosis: Request timeout');
      console.log('   - Check network connectivity');
      console.log('   - Verify server is responding');
    } else {
      console.log('\n🔧 Diagnosis: Unknown error');
      console.log('   - Check server logs for more details');
    }
  }
}

testServiceError().catch(console.error);