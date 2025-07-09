// Main application JavaScript
class VisualizationApp {
    constructor() {
        this.currentVisualization = null;
        this.websocket = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadVisualizationsList();
        this.checkSystemStatus();
    }

    setupEventListeners() {
        // Form submission
        const form = document.getElementById('create-viz-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createVisualization();
            });
        }

        // Navigation buttons
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.showDashboard();
            });
        }

        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshVisualization();
            });
        }

        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'r':
                        e.preventDefault();
                        if (this.currentVisualization) {
                            this.refreshVisualization();
                        }
                        break;
                    case 'f':
                        e.preventDefault();
                        if (this.currentVisualization) {
                            this.toggleFullscreen();
                        }
                        break;
                }
            }
            if (e.key === 'Escape') {
                if (this.currentVisualization && document.fullscreenElement) {
                    document.exitFullscreen();
                } else if (this.currentVisualization) {
                    this.showDashboard();
                }
            }
        });
    }

    async createVisualization() {
        const form = document.getElementById('create-viz-form');
        const formData = new FormData(form);
        
        const data = {
            title: formData.get('title'),
            subtitle: formData.get('subtitle') || '',
            theme: formData.get('theme'),
            dataQuery: {
                type: 'Portfolio',
                include: ['Epics', 'UserStories', 'Teams']
            }
        };

        try {
            this.showLoading('Creating visualization...');
            
            const response = await fetch('/api/visualizations/sankey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.hideLoading();
            this.showVisualization(result.id);
            this.loadVisualizationsList(); // Refresh the list
            this.showToast('Visualization created successfully!', 'success');
            
        } catch (error) {
            console.error('Error creating visualization:', error);
            this.hideLoading();
            this.showToast('Failed to create visualization: ' + error.message, 'error');
        }
    }

    async loadVisualizationsList() {
        try {
            const response = await fetch('/api/visualizations');
            const data = await response.json();
            
            const listContainer = document.getElementById('visualizations-list');
            
            if (data.visualizations.length === 0) {
                listContainer.innerHTML = '<div class="empty-state">No visualizations found. Create your first one!</div>';
                return;
            }

            const listHTML = data.visualizations.map(viz => `
                <div class="visualization-item" onclick="app.showVisualization('${viz.id}')">
                    <div class="viz-header">
                        <h3>${viz.title}</h3>
                        <span class="theme-badge theme-${viz.theme}">${viz.theme}</span>
                    </div>
                    ${viz.subtitle ? `<p class="viz-subtitle">${viz.subtitle}</p>` : ''}
                    <div class="viz-meta">
                        <span>Created: ${new Date(viz.createdAt).toLocaleDateString()}</span>
                        <span>Updated: ${new Date(viz.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div class="viz-actions">
                        <button class="btn-small" onclick="event.stopPropagation(); app.refreshVisualization('${viz.id}')">🔄</button>
                        <button class="btn-small btn-danger" onclick="event.stopPropagation(); app.deleteVisualization('${viz.id}')">🗑️</button>
                    </div>
                </div>
            `).join('');

            listContainer.innerHTML = listHTML;
            
        } catch (error) {
            console.error('Error loading visualizations:', error);
            document.getElementById('visualizations-list').innerHTML = 
                '<div class="error-state">Failed to load visualizations</div>';
        }
    }

    async showVisualization(id) {
        this.currentVisualization = id;
        
        try {
            // Hide dashboard and show visualization container
            document.getElementById('dashboard').style.display = 'none';
            document.getElementById('visualization-container').style.display = 'block';
            
            this.showLoading('Loading visualization...');
            
            const response = await fetch(`/api/visualizations/${id}?embed=true`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            document.getElementById('visualization-content').innerHTML = html;
            
            this.hideLoading();
            
            // Initialize WebSocket connection for real-time updates
            this.initializeWebSocket(id);
            
        } catch (error) {
            console.error('Error loading visualization:', error);
            this.hideLoading();
            this.showToast('Failed to load visualization: ' + error.message, 'error');
        }
    }

    showDashboard() {
        document.getElementById('dashboard').style.display = 'grid';
        document.getElementById('visualization-container').style.display = 'none';
        this.currentVisualization = null;
        
        // Close WebSocket connection
        if (this.websocket) {
            this.websocket.disconnect();
            this.websocket = null;
        }
        
        // Exit fullscreen if active
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    }

    async refreshVisualization(id = null) {
        const vizId = id || this.currentVisualization;
        if (!vizId) return;
        
        try {
            this.showLoading('Refreshing data...');
            
            const response = await fetch(`/api/visualizations/${vizId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.hideLoading();
            this.showToast('Visualization refreshed successfully', 'success');
            
            // If we're currently viewing this visualization, the WebSocket will update it
            if (vizId === this.currentVisualization) {
                // The update will come via WebSocket
            } else {
                // Refresh the list to show updated timestamp
                this.loadVisualizationsList();
            }
            
        } catch (error) {
            console.error('Error refreshing visualization:', error);
            this.hideLoading();
            this.showToast('Failed to refresh visualization: ' + error.message, 'error');
        }
    }

    async deleteVisualization(id) {
        if (!confirm('Are you sure you want to delete this visualization?')) {
            return;
        }

        try {
            const response = await fetch(`/api/visualizations/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.showToast('Visualization deleted successfully', 'success');
            this.loadVisualizationsList();

            // If we're currently viewing this visualization, go back to dashboard
            if (id === this.currentVisualization) {
                this.showDashboard();
            }

        } catch (error) {
            console.error('Error deleting visualization:', error);
            this.showToast('Failed to delete visualization: ' + error.message, 'error');
        }
    }

    async checkSystemStatus() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            
            // Update status indicators
            document.getElementById('tp-status').textContent = 
                data.checks.targetprocess.status === 'healthy' ? '✅ Connected' : '❌ Error';
            document.getElementById('ws-status').textContent = 
                data.checks.websocket.status === 'healthy' ? '✅ Ready' : '❌ Error';
            document.getElementById('cache-status').textContent = 
                data.checks.cache.status === 'healthy' ? '✅ Active' : '❌ Error';
            
        } catch (error) {
            console.error('Error checking system status:', error);
            // Show error state
            document.getElementById('tp-status').textContent = '❌ Error';
            document.getElementById('ws-status').textContent = '❌ Error';
            document.getElementById('cache-status').textContent = '❌ Error';
        }
    }

    initializeWebSocket(visualizationId) {
        // Clean up existing connection
        if (this.websocket) {
            this.websocket.disconnect();
        }

        // Create new connection
        this.websocket = new WebSocketClient();
        
        this.websocket.connect()
            .then(() => {
                this.websocket.subscribe(visualizationId);
                console.log('WebSocket connected for visualization:', visualizationId);
            })
            .catch(error => {
                console.error('Failed to connect to WebSocket:', error);
                this.showToast('Real-time updates unavailable', 'warning');
            });
    }

    toggleFullscreen() {
        const container = document.getElementById('visualization-container');
        
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    showLoading(message) {
        let loader = document.getElementById('loading-overlay');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'loading-overlay';
            loader.className = 'loading-overlay';
            document.body.appendChild(loader);
        }
        
        loader.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
        loader.style.display = 'flex';
    }

    hideLoading() {
        const loader = document.getElementById('loading-overlay');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        const container = document.getElementById('toast-container');
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new VisualizationApp();
    
    // Check system status periodically
    setInterval(() => {
        window.app.checkSystemStatus();
    }, 30000); // Every 30 seconds
});

// Handle visibility change to refresh when tab becomes active
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.app && window.app.currentVisualization) {
        // Refresh current visualization when tab becomes visible
        setTimeout(() => {
            window.app.refreshVisualization();
        }, 1000);
    }
});