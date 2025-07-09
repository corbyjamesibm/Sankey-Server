// WebSocket client for real-time updates
class WebSocketClient {
    constructor(options = {}) {
        this.options = {
            reconnectAttempts: 5,
            reconnectDelay: 1000,
            heartbeatInterval: 30000,
            ...options
        };
        
        this.ws = null;
        this.reconnectCount = 0;
        this.isConnected = false;
        this.subscriptions = new Set();
        this.messageHandlers = new Map();
        this.heartbeatTimer = null;
        
        this.setupMessageHandlers();
    }

    setupMessageHandlers() {
        this.messageHandlers.set('connected', (data) => {
            console.log('WebSocket connected:', data.clientId);
            this.isConnected = true;
            this.reconnectCount = 0;
            this.updateConnectionStatus(true);
            this.startHeartbeat();
            
            // Re-subscribe to any existing subscriptions
            this.subscriptions.forEach(visualizationId => {
                this.subscribe(visualizationId);
            });
        });

        this.messageHandlers.set('subscribed', (data) => {
            console.log('Subscribed to visualization:', data.visualizationId);
            this.showNotification('Subscribed to real-time updates', 'success');
        });

        this.messageHandlers.set('unsubscribed', (data) => {
            console.log('Unsubscribed from visualization:', data.visualizationId);
        });

        this.messageHandlers.set('visualization_update', (data) => {
            console.log('Received visualization update:', data.visualizationId);
            this.handleVisualizationUpdate(data);
        });

        this.messageHandlers.set('error', (data) => {
            console.error('WebSocket error:', data.message);
            this.showNotification('WebSocket error: ' + data.message, 'error');
        });

        this.messageHandlers.set('pong', (data) => {
            // Handle ping/pong for keep-alive
            this.lastPong = Date.now();
        });

        this.messageHandlers.set('server_shutdown', (data) => {
            console.warn('Server shutting down:', data.message);
            this.showNotification('Server is shutting down', 'warning');
            this.disconnect();
        });
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/ws`;

                console.log('Connecting to WebSocket:', wsUrl);
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('WebSocket connection established');
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('WebSocket connection closed:', event.code, event.reason);
                    this.isConnected = false;
                    this.updateConnectionStatus(false);
                    this.stopHeartbeat();
                    
                    if (event.code !== 1000) { // Not a normal closure
                        this.attemptReconnect();
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.isConnected = false;
                    this.updateConnectionStatus(false);
                    reject(error);
                };

            } catch (error) {
                console.error('Error creating WebSocket connection:', error);
                reject(error);
            }
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
        }
        this.isConnected = false;
        this.subscriptions.clear();
        this.stopHeartbeat();
        this.updateConnectionStatus(false);
    }

    handleMessage(data) {
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
            handler(data);
        } else {
            console.warn('Unknown message type:', data.type);
        }
    }

    handleVisualizationUpdate(data) {
        // Update the visualization with new data
        if (typeof window.updateSankeyData === 'function') {
            window.updateSankeyData(data.data);
        }
        
        // Show update notification
        this.showUpdateNotification();
    }

    subscribe(visualizationId) {
        if (!visualizationId) {
            console.warn('Cannot subscribe: no visualization ID provided');
            return;
        }

        this.subscriptions.add(visualizationId);
        
        if (this.isConnected) {
            this.send({
                type: 'subscribe',
                visualizationId: visualizationId
            });
        }
    }

    unsubscribe(visualizationId) {
        this.subscriptions.delete(visualizationId);
        
        if (this.isConnected) {
            this.send({
                type: 'unsubscribe',
                visualizationId: visualizationId
            });
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    ping() {
        if (this.isConnected) {
            this.send({ type: 'ping' });
        }
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            this.ping();
        }, this.options.heartbeatInterval);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    attemptReconnect() {
        if (this.reconnectCount >= this.options.reconnectAttempts) {
            console.log('Max reconnection attempts reached');
            this.showNotification('Connection lost. Please refresh the page.', 'error');
            return;
        }

        this.reconnectCount++;
        const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectCount - 1);
        
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectCount})`);
        
        setTimeout(() => {
            this.connect().catch(error => {
                console.error('Reconnection failed:', error);
            });
        }, delay);
    }

    updateConnectionStatus(connected) {
        // Update any real-time indicators
        let indicators = document.querySelectorAll('.real-time-indicator');
        
        indicators.forEach(indicator => {
            if (connected) {
                indicator.className = 'real-time-indicator connected';
                indicator.textContent = 'Real-time';
            } else {
                indicator.className = 'real-time-indicator disconnected';
                indicator.textContent = 'Disconnected';
            }
        });

        // Create indicator if it doesn't exist
        if (indicators.length === 0) {
            const containers = document.querySelectorAll('.chart-container, .visualization-header');
            containers.forEach(container => {
                const indicator = document.createElement('div');
                indicator.className = connected ? 'real-time-indicator connected' : 'real-time-indicator disconnected';
                indicator.textContent = connected ? 'Real-time' : 'Disconnected';
                container.appendChild(indicator);
            });
        }
    }

    showUpdateNotification() {
        this.showNotification('Visualization updated', 'success', 2000);
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 12px 20px;
            border-radius: 5px;
            z-index: 1000;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
            word-wrap: break-word;
        `;

        document.body.appendChild(notification);

        // Auto-remove after duration
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    getNotificationColor(type) {
        switch (type) {
            case 'success': return '#27ae60';
            case 'error': return '#e74c3c';
            case 'warning': return '#f39c12';
            default: return '#3498db';
        }
    }

    // Get connection status
    getStatus() {
        return {
            connected: this.isConnected,
            reconnectCount: this.reconnectCount,
            subscriptions: Array.from(this.subscriptions),
            readyState: this.ws ? this.ws.readyState : WebSocket.CLOSED
        };
    }
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .real-time-indicator {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 5px 10px;
        border-radius: 15px;
        font-size: 0.8em;
        font-weight: bold;
        color: white;
        display: flex;
        align-items: center;
        gap: 5px;
        z-index: 10;
    }
    
    .real-time-indicator.connected {
        background: #27ae60;
    }
    
    .real-time-indicator.disconnected {
        background: #e74c3c;
    }
    
    .real-time-indicator::before {
        content: '●';
        animation: pulse 1s infinite;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
    }
`;
document.head.appendChild(style);

// Global WebSocket client instance
let wsClient = null;

// Initialize WebSocket client when visualization is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on a visualization page
    if (typeof window.visualizationId !== 'undefined') {
        console.log('Initializing WebSocket client for visualization:', window.visualizationId);
        
        wsClient = new WebSocketClient();
        
        // Connect and subscribe
        wsClient.connect()
            .then(() => {
                wsClient.subscribe(window.visualizationId);
            })
            .catch(error => {
                console.error('Failed to connect to WebSocket:', error);
            });
        
        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            if (wsClient) {
                wsClient.disconnect();
            }
        });
    }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WebSocketClient };
}

// Make available globally
window.WebSocketClient = WebSocketClient;
window.wsClient = wsClient;