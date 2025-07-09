// Sankey Data Transformer - Converts TargetProcess data to D3.js Sankey format
// Based on the example structure from the PRD

class SankeyTransformer {
  constructor(theme = 'targetprocess') {
    this.theme = theme;
    this.colors = this.getThemeColors(theme);
  }

  transform(rawData, options = {}) {
    const { title = 'Portfolio Flow', subtitle = '', theme = this.theme } = options;
    
    try {
      // Extract different entity types from the raw data
      const portfolios = rawData.portfolios || [];
      const epics = rawData.epics || [];
      const userStories = rawData.userStories || [];
      const teams = rawData.teams || [];

      console.log(`Transforming data: ${portfolios.length} portfolios, ${epics.length} epics, ${userStories.length} stories, ${teams.length} teams`);

      // Build the Sankey structure
      const sankeyData = {
        metadata: {
          title,
          subtitle,
          stats: this.calculateStats(portfolios, epics, userStories, teams),
          theme,
          timestamp: new Date().toISOString()
        },
        data: {
          nodes: [],
          links: []
        },
        styling: this.getThemeConfig(theme)
      };

      // Create nodes for each level
      const nodeMap = new Map();
      let nodeIndex = 0;

      // Level 0: Portfolios
      portfolios.forEach(portfolio => {
        const node = {
          name: this.formatNodeName(portfolio.Name || 'Unnamed Portfolio'),
          level: 0,
          type: this.getPortfolioType(portfolio),
          value: this.calculatePortfolioValue(portfolio, epics, userStories),
          id: portfolio.Id,
          entityType: 'Portfolio',
          originalData: portfolio
        };
        sankeyData.data.nodes.push(node);
        nodeMap.set(`Portfolio-${portfolio.Id}`, nodeIndex++);
      });

      // Level 1: Epics
      epics.forEach(epic => {
        const node = {
          name: this.formatNodeName(epic.Name || 'Unnamed Epic'),
          level: 1,
          type: this.getEpicType(epic),
          value: this.calculateEpicValue(epic, userStories),
          id: epic.Id,
          entityType: 'Epic',
          originalData: epic
        };
        sankeyData.data.nodes.push(node);
        nodeMap.set(`Epic-${epic.Id}`, nodeIndex++);
      });

      // Level 2: Work Allocations (User Stories grouped by team)
      const workAllocations = this.createWorkAllocations(userStories, teams);
      workAllocations.forEach(allocation => {
        const node = {
          name: allocation.name,
          level: 2,
          type: allocation.type,
          value: allocation.value,
          id: allocation.id,
          entityType: 'WorkAllocation',
          originalData: allocation
        };
        sankeyData.data.nodes.push(node);
        nodeMap.set(`WorkAllocation-${allocation.id}`, nodeIndex++);
      });

      // Level 3: Teams
      teams.forEach(team => {
        const node = {
          name: this.formatNodeName(team.Name || 'Unnamed Team'),
          level: 3,
          type: this.getTeamType(team),
          value: this.calculateTeamValue(team, userStories),
          id: team.Id,
          entityType: 'Team',
          originalData: team
        };
        sankeyData.data.nodes.push(node);
        nodeMap.set(`Team-${team.Id}`, nodeIndex++);
      });

      // Create links between levels
      sankeyData.data.links = this.createLinks(
        portfolios, 
        epics, 
        userStories, 
        teams, 
        workAllocations, 
        nodeMap
      );

      console.log(`Generated Sankey data: ${sankeyData.data.nodes.length} nodes, ${sankeyData.data.links.length} links`);

      return sankeyData;

    } catch (error) {
      console.error('Error transforming data to Sankey format:', error);
      throw new Error(`Failed to transform data to Sankey format: ${error.message}`);
    }
  }

  calculateStats(portfolios, epics, userStories, teams) {
    const totalStoryPoints = userStories.reduce((sum, s) => sum + (s.StoryPoints || 0), 0);
    const completedStories = userStories.filter(s => s.EntityState && s.EntityState.Name === 'Done').length;
    const totalBudget = portfolios.reduce((sum, p) => sum + (p.Budget || 0), 0);
    const activeTeams = teams.filter(t => t.IsActive !== false).length;
    
    return [
      { label: 'Active Portfolios', value: portfolios.length.toString() },
      { label: 'Portfolio Epics', value: epics.length.toString() },
      { label: 'User Stories', value: userStories.length.toString() },
      { label: 'Active Teams', value: activeTeams.toString() },
      { label: 'Total Story Points', value: totalStoryPoints.toString() },
      { label: 'Completed Stories', value: completedStories.toString() }
    ];
  }

  getPortfolioType(portfolio) {
    const name = (portfolio.Name || '').toLowerCase();
    if (name.includes('ai') || name.includes('artificial')) return 'portfolio_ai';
    if (name.includes('transform')) return 'portfolio_transform';
    if (name.includes('cloud')) return 'portfolio_cloud';
    return 'portfolio_default';
  }

  getEpicType(epic) {
    const name = (epic.Name || '').toLowerCase();
    if (name.includes('ai') || name.includes('artificial')) return 'epic_ai';
    if (name.includes('transform')) return 'epic_transform';
    if (name.includes('cloud') || name.includes('migration')) return 'epic_cloud';
    if (name.includes('test')) return 'epic_test';
    return 'epic_default';
  }

  getTeamType(team) {
    const rate = team.HourlyRate || 0;
    if (rate >= 600) return 'team_premium';
    if (rate >= 400) return 'team_high';
    if (rate >= 200) return 'team_mid';
    return 'team_standard';
  }

  calculatePortfolioValue(portfolio, epics, userStories) {
    const portfolioEpics = epics.filter(e => e.Portfolio && e.Portfolio.Id === portfolio.Id);
    const portfolioStories = userStories.filter(s => {
      return portfolioEpics.some(e => s.Epic && s.Epic.Id === e.Id);
    });
    
    const totalPoints = portfolioStories.reduce((sum, s) => sum + (s.StoryPoints || 1), 0);
    return Math.max(totalPoints / 10, 1); // Scale for display, minimum 1
  }

  calculateEpicValue(epic, userStories) {
    const epicStories = userStories.filter(s => s.Epic && s.Epic.Id === epic.Id);
    const totalPoints = epicStories.reduce((sum, s) => sum + (s.StoryPoints || 1), 0);
    return Math.max(totalPoints / 10, 1); // Scale for display, minimum 1
  }

  calculateTeamValue(team, userStories) {
    const teamStories = userStories.filter(s => s.Team && s.Team.Id === team.Id);
    const totalPoints = teamStories.reduce((sum, s) => sum + (s.StoryPoints || 1), 0);
    return Math.max(totalPoints / 10, 1); // Scale for display, minimum 1
  }

  createWorkAllocations(userStories, teams) {
    const allocations = [];
    const teamAllocations = new Map();

    // Group user stories by team and epic
    userStories.forEach(story => {
      if (!story.Team || !story.Epic) return;

      const key = `${story.Team.Id}-${story.Epic.Id}`;
      if (!teamAllocations.has(key)) {
        teamAllocations.set(key, {
          teamId: story.Team.Id,
          teamName: story.Team.Name || 'Unknown Team',
          epicId: story.Epic.Id,
          epicName: story.Epic.Name || 'Unknown Epic',
          stories: []
        });
      }

      teamAllocations.get(key).stories.push(story);
    });

    // Create allocation nodes
    let allocationId = 1;
    teamAllocations.forEach((allocation, key) => {
      const totalPoints = allocation.stories.reduce((sum, s) => sum + (s.StoryPoints || 1), 0);
      const value = Math.max(totalPoints / 10, 1); // Scale for display, minimum 1
      const percentage = this.calculateTeamAllocationPercentage(allocation, teams);
      
      allocations.push({
        id: allocationId++,
        name: this.formatAllocationName(allocation.teamName, allocation.epicName, percentage),
        type: this.getWorkAllocationType(allocation),
        value,
        teamId: allocation.teamId,
        epicId: allocation.epicId,
        stories: allocation.stories,
        percentage
      });
    });

    return allocations;
  }

  calculateTeamAllocationPercentage(allocation, teams) {
    const storyPoints = allocation.stories.reduce((sum, s) => sum + (s.StoryPoints || 1), 0);
    const team = teams.find(t => t.Id === allocation.teamId);
    const teamCapacity = team?.Capacity || 100; // Default capacity
    
    return Math.min(Math.round((storyPoints / teamCapacity) * 100), 100);
  }

  getWorkAllocationType(allocation) {
    const epicName = allocation.epicName.toLowerCase();
    if (epicName.includes('ai')) return 'work_ai';
    if (epicName.includes('transform')) return 'work_transform';
    if (epicName.includes('cloud') || epicName.includes('infra')) return 'work_infra';
    if (epicName.includes('test')) return 'work_test';
    return 'work_default';
  }

  formatNodeName(name) {
    // Split long names into multiple lines
    if (name.length > 15) {
      const words = name.split(' ');
      if (words.length > 1) {
        const midpoint = Math.ceil(words.length / 2);
        return `${words.slice(0, midpoint).join(' ')}\n${words.slice(midpoint).join(' ')}`;
      }
      return name.substring(0, 15) + '...';
    }
    return name;
  }

  formatAllocationName(teamName, epicName, percentage) {
    const shortTeamName = teamName.length > 12 ? teamName.substring(0, 12) + '...' : teamName;
    const shortEpicName = epicName.length > 15 ? epicName.substring(0, 15) + '...' : epicName;
    return `${shortTeamName} (${percentage}%)\n${shortEpicName}`;
  }

  createLinks(portfolios, epics, userStories, teams, workAllocations, nodeMap) {
    const links = [];

    // Level 0 → Level 1: Portfolios to Epics
    epics.forEach(epic => {
      if (epic.Portfolio) {
        const sourceIndex = nodeMap.get(`Portfolio-${epic.Portfolio.Id}`);
        const targetIndex = nodeMap.get(`Epic-${epic.Id}`);
        
        if (sourceIndex !== undefined && targetIndex !== undefined) {
          links.push({
            source: sourceIndex,
            target: targetIndex,
            value: this.calculateEpicValue(epic, userStories)
          });
        }
      }
    });

    // Level 1 → Level 2: Epics to Work Allocations
    workAllocations.forEach(allocation => {
      const sourceIndex = nodeMap.get(`Epic-${allocation.epicId}`);
      const targetIndex = nodeMap.get(`WorkAllocation-${allocation.id}`);
      
      if (sourceIndex !== undefined && targetIndex !== undefined) {
        links.push({
          source: sourceIndex,
          target: targetIndex,
          value: allocation.value
        });
      }
    });

    // Level 2 → Level 3: Work Allocations to Teams
    workAllocations.forEach(allocation => {
      const sourceIndex = nodeMap.get(`WorkAllocation-${allocation.id}`);
      const targetIndex = nodeMap.get(`Team-${allocation.teamId}`);
      
      if (sourceIndex !== undefined && targetIndex !== undefined) {
        links.push({
          source: sourceIndex,
          target: targetIndex,
          value: allocation.value
        });
      }
    });

    return links;
  }

  getThemeColors(theme) {
    if (theme === 'targetprocess') {
      return {
        portfolio_ai: '#3498db',
        portfolio_transform: '#2980b9',
        portfolio_cloud: '#1abc9c',
        portfolio_default: '#34495e',
        epic_ai: '#9b59b6',
        epic_transform: '#16a085',
        epic_cloud: '#27ae60',
        epic_test: '#95a5a6',
        epic_default: '#7f8c8d',
        work_ai: '#e74c3c',
        work_transform: '#e67e22',
        work_infra: '#f39c12',
        work_test: '#f1c40f',
        work_default: '#bdc3c7',
        team_premium: '#8e44ad',
        team_high: '#d35400',
        team_mid: '#f39c12',
        team_standard: '#2ecc71'
      };
    }
    
    return {
      default: '#1f77b4',
      secondary: '#ff7f0e',
      tertiary: '#2ca02c'
    };
  }

  getThemeConfig(theme) {
    return {
      colors: this.getThemeColors(theme),
      legend: this.getLegendConfig(theme)
    };
  }

  getLegendConfig(theme) {
    if (theme === 'targetprocess') {
      return {
        sections: [
          {
            title: 'Portfolios',
            items: [
              { color: '#3498db', label: 'AI Portfolio' },
              { color: '#2980b9', label: 'Transformation Portfolio' },
              { color: '#1abc9c', label: 'Cloud Portfolio' },
              { color: '#34495e', label: 'Other Portfolios' }
            ]
          },
          {
            title: 'Team Cost Tiers',
            items: [
              { color: '#8e44ad', label: 'Premium Teams (>$600/hr)' },
              { color: '#d35400', label: 'High-Cost Teams ($400-600/hr)' },
              { color: '#f39c12', label: 'Mid-Tier Teams ($200-400/hr)' },
              { color: '#2ecc71', label: 'Standard Teams (<$200/hr)' }
            ]
          },
          {
            title: 'Work Types',
            items: [
              { color: '#e74c3c', label: 'AI/ML Work' },
              { color: '#e67e22', label: 'Transformation Work' },
              { color: '#f39c12', label: 'Infrastructure Work' },
              { color: '#f1c40f', label: 'Testing Work' }
            ]
          }
        ]
      };
    }
    
    return {
      sections: [
        {
          title: 'Default Theme',
          items: [
            { color: '#1f77b4', label: 'Primary' },
            { color: '#ff7f0e', label: 'Secondary' },
            { color: '#2ca02c', label: 'Tertiary' }
          ]
        }
      ]
    };
  }
}

module.exports = { SankeyTransformer };