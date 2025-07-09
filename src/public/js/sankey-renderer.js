// D3.js Sankey diagram renderer
class SankeyRenderer {
    constructor(containerId, data, options = {}) {
        this.containerId = containerId;
        this.data = data;
        this.options = {
            margin: { top: 40, right: 40, bottom: 40, left: 40 },
            nodeWidth: 18,
            nodePadding: 10,
            ...options
        };
        this.colors = data.styling?.colors || {};
        this.tooltip = null;
        this.svg = null;
        this.initialized = false;
        
        this.init();
    }

    init() {
        if (!this.validateData()) {
            console.error('Invalid data structure for Sankey diagram');
            return;
        }

        this.createContainer();
        this.createTooltip();
        this.render();
        this.initialized = true;
    }

    validateData() {
        return this.data && 
               this.data.data && 
               this.data.data.nodes && 
               this.data.data.links && 
               Array.isArray(this.data.data.nodes) && 
               Array.isArray(this.data.data.links);
    }

    createContainer() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Container with id '${this.containerId}' not found`);
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        // Create SVG container
        this.svg = d3.select(container)
            .append('svg')
            .attr('class', 'sankey-svg');

        // Create main group
        this.g = this.svg.append('g')
            .attr('class', 'sankey-main');
    }

    createTooltip() {
        // Remove existing tooltip
        d3.select('.sankey-tooltip').remove();

        this.tooltip = d3.select('body')
            .append('div')
            .attr('class', 'sankey-tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', 'white')
            .style('padding', '12px')
            .style('border-radius', '8px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('max-width', '250px')
            .style('box-shadow', '0 4px 15px rgba(0,0,0,0.3)');
    }

    render() {
        if (!this.svg || !this.data.data.nodes || !this.data.data.links) {
            console.error('Cannot render: missing required elements');
            return;
        }

        // Calculate dimensions
        const container = document.getElementById(this.containerId);
        const containerRect = container.getBoundingClientRect();
        const width = Math.max(800, containerRect.width) - this.options.margin.left - this.options.margin.right;
        const height = Math.max(500, Math.min(700, window.innerHeight * 0.7)) - this.options.margin.top - this.options.margin.bottom;

        // Set SVG dimensions
        this.svg
            .attr('width', width + this.options.margin.left + this.options.margin.right)
            .attr('height', height + this.options.margin.top + this.options.margin.bottom);

        // Set main group transform
        this.g.attr('transform', `translate(${this.options.margin.left},${this.options.margin.top})`);

        // Create sankey generator
        const sankey = d3.sankey()
            .nodeWidth(this.options.nodeWidth)
            .nodePadding(this.options.nodePadding)
            .extent([[1, 1], [width - 1, height - 6]]);

        // Prepare data - ensure proper structure
        const graph = {
            nodes: this.data.data.nodes.map(d => ({ ...d })),
            links: this.data.data.links.map(d => ({ ...d }))
        };

        // Generate sankey layout
        const sankeyData = sankey(graph);

        // Clear existing elements
        this.g.selectAll('*').remove();

        // Render links
        this.renderLinks(sankeyData.links);

        // Render nodes
        this.renderNodes(sankeyData.nodes);

        // Add animations
        this.addAnimations();
    }

    renderLinks(links) {
        const link = this.g.append('g')
            .attr('class', 'links')
            .selectAll('path')
            .data(links)
            .enter()
            .append('path')
            .attr('class', 'sankey-link')
            .attr('d', d3.sankeyLinkHorizontal())
            .attr('stroke', d => this.getLinkColor(d))
            .attr('stroke-width', d => Math.max(2, d.width))
            .attr('fill', 'none')
            .attr('stroke-opacity', 0.4)
            .on('mouseover', (event, d) => this.showTooltip(event, d, 'link'))
            .on('mouseout', () => this.hideTooltip())
            .on('mousemove', (event) => this.moveTooltip(event));

        // Add hover effects
        link.on('mouseenter', function() {
            d3.select(this).attr('stroke-opacity', 0.7);
        }).on('mouseleave', function() {
            d3.select(this).attr('stroke-opacity', 0.4);
        });
    }

    renderNodes(nodes) {
        const node = this.g.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'sankey-node')
            .attr('transform', d => `translate(${d.x0},${d.y0})`);

        // Add rectangles
        node.append('rect')
            .attr('height', d => d.y1 - d.y0)
            .attr('width', d => d.x1 - d.x0)
            .attr('fill', d => this.getNodeColor(d))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('rx', 2)
            .attr('ry', 2)
            .on('mouseover', (event, d) => this.showTooltip(event, d, 'node'))
            .on('mouseout', () => this.hideTooltip())
            .on('mousemove', (event) => this.moveTooltip(event));

        // Add text labels
        this.addNodeLabels(node);
    }

    addNodeLabels(node) {
        // Main label
        node.append('text')
            .attr('x', d => (d.x1 - d.x0) / 2)
            .attr('y', d => (d.y1 - d.y0) / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .attr('fill', '#2c3e50')
            .style('pointer-events', 'none')
            .text(d => this.getNodeMainLabel(d));

        // Secondary label
        node.append('text')
            .attr('x', d => (d.x1 - d.x0) / 2)
            .attr('y', d => (d.y1 - d.y0) / 2 + 12)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .attr('font-size', '9px')
            .attr('font-weight', 'normal')
            .attr('fill', '#7f8c8d')
            .style('pointer-events', 'none')
            .text(d => this.getNodeSecondaryLabel(d));
    }

    getLinkColor(d) {
        const sourceType = d.source.type;
        return this.colors[sourceType] || '#bdc3c7';
    }

    getNodeColor(d) {
        return this.colors[d.type] || '#bdc3c7';
    }

    getNodeMainLabel(d) {
        const lines = d.name.split('\n');
        const firstLine = lines[0];
        return firstLine.length > 12 ? firstLine.substring(0, 12) + '...' : firstLine;
    }

    getNodeSecondaryLabel(d) {
        const lines = d.name.split('\n');
        if (lines[1]) {
            return lines[1].length > 12 ? lines[1].substring(0, 12) + '...' : lines[1];
        }
        return '';
    }

    showTooltip(event, d, type) {
        let content = '';
        
        if (type === 'link') {
            const sourceName = d.source.name.split('\n')[0];
            const targetName = d.target.name.split('\n')[0];
            const percentage = d.source.name.includes('%') ? 
                d.source.name.match(/\((\d+%)\)/)?.[1] || '' : '';
            
            content = `
                <div><strong>Flow:</strong> ${sourceName}</div>
                <div><strong>→ To:</strong> ${targetName}</div>
                <div><strong>Value:</strong> ${d.value.toFixed(1)}</div>
                ${percentage ? `<div><strong>Allocation:</strong> ${percentage}</div>` : ''}
            `;
        } else {
            const levelNames = ['Portfolio', 'Epic', 'Work Allocation', 'Team'];
            const levelName = levelNames[d.level] || 'Entity';
            
            let valueInfo = `${d.value?.toFixed(1) || '0'}`;
            if (d.name.includes('%')) {
                const percentage = d.name.match(/\((\d+%)\)/)?.[1] || '';
                valueInfo += ` (${percentage} allocation)`;
            }
            
            content = `
                <div><strong>${levelName}:</strong> ${d.name.split('\n')[0]}</div>
                <div><strong>Value:</strong> ${valueInfo}</div>
                <div><strong>Type:</strong> ${d.type.replace('_', ' ')}</div>
                <div><strong>Level:</strong> ${d.level + 1} of 4</div>
            `;
        }

        this.tooltip.transition()
            .duration(200)
            .style('opacity', 0.95);

        this.tooltip.html(content);
        this.moveTooltip(event);
    }

    hideTooltip() {
        this.tooltip.transition()
            .duration(500)
            .style('opacity', 0);
    }

    moveTooltip(event) {
        if (this.tooltip) {
            this.tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        }
    }

    addAnimations() {
        // Animate nodes
        this.g.selectAll('.sankey-node rect')
            .style('opacity', 0)
            .transition()
            .duration(1200)
            .delay((d, i) => d.level * 200 + i * 30)
            .style('opacity', 1);

        // Animate links
        this.g.selectAll('.sankey-link')
            .style('stroke-opacity', 0)
            .transition()
            .duration(1800)
            .delay(800)
            .style('stroke-opacity', 0.4);

        // Animate text
        this.g.selectAll('.sankey-node text')
            .style('opacity', 0)
            .transition()
            .duration(1000)
            .delay((d, i) => d.level * 200 + i * 30 + 600)
            .style('opacity', 1);
    }

    // Method to update the visualization with new data
    updateData(newData) {
        this.data = newData;
        this.colors = newData.styling?.colors || {};
        
        if (this.initialized) {
            this.render();
        }
    }

    // Method to resize the visualization
    resize() {
        if (this.initialized) {
            this.render();
        }
    }

    // Method to destroy the visualization
    destroy() {
        if (this.tooltip) {
            this.tooltip.remove();
        }
        if (this.svg) {
            this.svg.remove();
        }
        this.initialized = false;
    }
}

// Global function to initialize the Sankey visualization
function initializeSankey() {
    if (typeof window.visualizationData !== 'undefined' && window.visualizationData) {
        console.log('Initializing Sankey visualization...');
        
        const renderer = new SankeyRenderer('sankey-chart', window.visualizationData);
        
        // Make it globally accessible for updates
        window.sankeyRenderer = renderer;
        
        // Global function to update data (called from WebSocket)
        window.updateSankeyData = function(newData) {
            if (window.sankeyRenderer) {
                console.log('Updating Sankey data...');
                window.sankeyRenderer.updateData(newData);
            }
        };
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.sankeyRenderer) {
                setTimeout(() => {
                    window.sankeyRenderer.resize();
                }, 100);
            }
        });
        
        console.log('Sankey visualization initialized successfully');
    } else {
        console.warn('No visualization data found');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for D3 to be available
    if (typeof d3 !== 'undefined') {
        initializeSankey();
    } else {
        // Fallback: wait for D3 to load
        const checkD3 = setInterval(() => {
            if (typeof d3 !== 'undefined') {
                clearInterval(checkD3);
                initializeSankey();
            }
        }, 100);
        
        // Stop checking after 10 seconds
        setTimeout(() => {
            clearInterval(checkD3);
            console.error('D3.js failed to load within 10 seconds');
        }, 10000);
    }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SankeyRenderer };
}