#!/usr/bin/env node
// Test to discover available entity types
const { TPService } = require('./src/mcp/tp-service');

async function discoverEntityTypes() {
  console.log('🔍 Discovering Available Entity Types...\n');
  
  const config = {
    domain: 'apptiocsgfa.tpondemand.com',
    credentials: {
      username: 'admin',
      password: 'admin'
    }
  };
  
  const tpService = new TPService(config);
  
  // Common TargetProcess entity types to test
  const entityTypes = [
    'Project',
    'Portfolio', 
    'Epic',
    'Feature',
    'UserStory',
    'Bug',
    'Task',
    'Team',
    'User',
    'Release',
    'Iteration',
    'TestCase',
    'Request',
    'Impediment'
  ];
  
  console.log('🔄 Testing entity types...\n');
  
  for (const entityType of entityTypes) {
    try {
      const response = await tpService.searchEntities({
        type: entityType,
        take: 1
      });
      
      const count = response?.Items?.length || 0;
      console.log(`✅ ${entityType}: ${count} items found`);
      
      if (count > 0) {
        const sample = response.Items[0];
        console.log(`   Sample: ${sample.Name || sample.Description || sample.Id} (ID: ${sample.Id})`);
      }
      
    } catch (error) {
      if (error.statusCode === 404) {
        console.log(`❌ ${entityType}: Not available (404)`);
      } else {
        console.log(`❌ ${entityType}: Error (${error.statusCode || 'unknown'})`);
      }
    }
  }
  
  console.log('\n🔄 Testing specific high-level entities...\n');
  
  // Test for program/portfolio-like entities
  const highLevelEntities = [
    'Program',
    'Initiative', 
    'Theme',
    'Objective',
    'Goal',
    'PortfolioProject',
    'PortfolioEpic'
  ];
  
  for (const entityType of highLevelEntities) {
    try {
      const response = await tpService.searchEntities({
        type: entityType,
        take: 1
      });
      
      const count = response?.Items?.length || 0;
      console.log(`✅ ${entityType}: ${count} items found`);
      
    } catch (error) {
      if (error.statusCode === 404) {
        console.log(`❌ ${entityType}: Not available (404)`);
      } else {
        console.log(`❌ ${entityType}: Error (${error.statusCode})`);
      }
    }
  }
}

discoverEntityTypes().catch(console.error);