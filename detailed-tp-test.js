#!/usr/bin/env node
// Detailed TargetProcess connection test
const fetch = require('node-fetch');

async function detailedTest() {
  const domain = process.env.TP_DOMAIN || 'apptiocsgfa.tpondemand.com';
  const username = process.env.TP_USERNAME || 'admin';
  const password = process.env.TP_PASSWORD || 'admin';
  
  console.log('🔍 Detailed TargetProcess Connection Test\n');
  console.log(`Domain: ${domain}`);
  console.log(`Username: ${username}`);
  console.log(`Password: ${password.replace(/./g, '*')}\n`);
  
  // Test 1: Check if domain resolves
  console.log('📡 Test 1: Domain Resolution');
  try {
    const response = await fetch(`https://${domain}`, { 
      method: 'GET',
      timeout: 10000
    });
    console.log(`✅ Domain accessible: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.log(`❌ Domain not accessible: ${error.message}`);
    return;
  }
  
  // Test 2: Check API endpoint
  console.log('\n🔧 Test 2: API Endpoint Check');
  const apiUrl = `https://${domain}/api/v1`;
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      timeout: 10000
    });
    console.log(`✅ API endpoint accessible: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.log(`❌ API endpoint not accessible: ${error.message}`);
  }
  
  // Test 3: Authentication test
  console.log('\n🔐 Test 3: Authentication Test');
  const authUrl = `https://${domain}/api/v1/Projects?take=1`;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  
  try {
    const response = await fetch(authUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'TargetProcess-D3-Visualization-Server/1.0.0'
      },
      timeout: 10000
    });
    
    console.log(`Response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Authentication successful!`);
      console.log(`Found ${data.length} project(s)`);
      
      if (data.length > 0) {
        console.log('\n📊 Sample projects:');
        data.slice(0, 3).forEach(project => {
          console.log(`  - ${project.Name} (ID: ${project.Id})`);
        });
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ Authentication failed: ${response.status} ${response.statusText}`);
      console.log(`Error response: ${errorText}`);
      
      // Specific error diagnostics
      if (response.status === 401) {
        console.log('\n🔧 Diagnosis: Invalid credentials');
        console.log('   - Check username and password');
        console.log('   - Verify account exists and has API access');
        console.log('   - Try logging into the web interface first');
      } else if (response.status === 404) {
        console.log('\n🔧 Diagnosis: API endpoint not found');
        console.log('   - Check if this is the correct TargetProcess instance');
        console.log('   - Verify the domain spelling');
        console.log('   - Check if API is enabled');
      } else if (response.status === 403) {
        console.log('\n🔧 Diagnosis: Access forbidden');
        console.log('   - Account may not have API access permissions');
        console.log('   - Contact TargetProcess administrator');
      }
    }
    
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }
  
  // Test 4: Alternative API versions
  console.log('\n🔄 Test 4: Alternative API Versions');
  const altVersions = ['v2', 'v3'];
  
  for (const version of altVersions) {
    try {
      const altUrl = `https://${domain}/api/${version}/Projects?take=1`;
      const response = await fetch(altUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      console.log(`API ${version}: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        console.log(`✅ API ${version} is working!`);
      }
    } catch (error) {
      console.log(`API ${version}: ${error.message}`);
    }
  }
}

// Run the detailed test
detailedTest().catch(console.error);