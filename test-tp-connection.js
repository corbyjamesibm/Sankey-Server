#!/usr/bin/env node
// Test script to diagnose TargetProcess connection issues
const { TPService } = require('./src/mcp/tp-service');

async function testConnection() {
  console.log('🔍 Testing TargetProcess Connection...\n');
  
  // Test with environment variables from Vercel
  const config = {
    domain: process.env.TP_DOMAIN || 'MISSING',
    credentials: {
      username: process.env.TP_USERNAME || 'MISSING',
      password: process.env.TP_PASSWORD || 'MISSING'
    }
  };
  
  console.log('📋 Configuration:');
  console.log(`  Domain: ${config.domain}`);
  console.log(`  Username: ${config.credentials.username ? '✅ Set' : '❌ Missing'}`);
  console.log(`  Password: ${config.credentials.password ? '✅ Set' : '❌ Missing'}`);
  console.log();
  
  if (config.domain === 'MISSING' || config.credentials.username === 'MISSING' || config.credentials.password === 'MISSING') {
    console.log('❌ Configuration Error: Missing required environment variables');
    console.log('Please set: TP_DOMAIN, TP_USERNAME, TP_PASSWORD');
    process.exit(1);
  }
  
  try {
    console.log('🔄 Creating TargetProcess service...');
    const tpService = new TPService(config);
    
    console.log('🔄 Testing connection...');
    const result = await tpService.testConnection();
    
    if (result.success) {
      console.log('✅ Connection successful!');
      console.log(`   ${result.message}`);
      
      // Show sample project data
      if (result.data?.Items?.length > 0) {
        console.log('\n📊 Sample data:');
        result.data.Items.slice(0, 3).forEach(project => {
          console.log(`  - ${project.Name} (ID: ${project.Id})`);
        });
      }
    } else {
      console.log('❌ Connection failed!');
      console.log(`   Error: ${result.error}`);
      
      // Common error diagnostics
      if (result.error.includes('401')) {
        console.log('\n🔧 Diagnosis: Authentication failed');
        console.log('   - Check username and password');
        console.log('   - Verify account has API access');
        console.log('   - Try using an API token instead');
      } else if (result.error.includes('404')) {
        console.log('\n🔧 Diagnosis: Domain not found');
        console.log('   - Check domain format (should be: company.tpondemand.com)');
        console.log('   - Verify the domain exists');
      } else if (result.error.includes('ENOTFOUND')) {
        console.log('\n🔧 Diagnosis: DNS resolution failed');
        console.log('   - Check internet connection');
        console.log('   - Verify domain spelling');
      }
    }
    
  } catch (error) {
    console.log('❌ Test failed with error:');
    console.log(`   ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  }
}

// Run the test
testConnection().catch(console.error);