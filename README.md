# TargetProcess D3 Visualization Server

A standalone web application that renders interactive D3.js Sankey diagrams using data from TargetProcess. Features real-time updates, responsive design, and seamless integration with TargetProcess dashboards.

## Features

- **Interactive Sankey Diagrams**: Portfolio flow visualization with D3.js
- **Real-time Updates**: WebSocket-powered live data synchronization
- **Responsive Design**: Mobile-first, works on all devices
- **TargetProcess Integration**: Embedded MCP client for data access
- **Dashboard Embedding**: Iframe-ready for TargetProcess dashboards
- **Professional Theming**: TargetProcess-styled UI components

## Quick Start

### Prerequisites

- Node.js 18+ 
- TargetProcess account and credentials
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd targetprocess-d3-visualization-server
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your TargetProcess credentials
```

4. Start the development server:
```bash
npm run dev
```

5. Open http://localhost:3000 in your browser

## Configuration

Create a `.env` file in the project root:

```bash
# TargetProcess Configuration
TP_DOMAIN=yourcompany.tpondemand.com
TP_USERNAME=your-username
TP_PASSWORD=your-password

# Server Configuration
PORT=3000
NODE_ENV=development

# Optional: Enable debug logging
DEBUG=true
```

## Usage

### Creating Visualizations

1. Access the dashboard at http://localhost:3000
2. Click "Create New Visualization"
3. Configure title, subtitle, and theme
4. Click "Create Visualization"
5. View your interactive Sankey diagram

### Embedding in TargetProcess

Use the iframe embed code provided in the visualization view:

```html
<iframe src="https://your-domain.com/embed/visualization-id" 
        width="100%" 
        height="600" 
        frameborder="0">
</iframe>
```

### Real-time Updates

The application automatically refreshes data and updates visualizations in real-time when:
- TargetProcess entities are modified
- New work items are created
- Allocations are updated

## API Reference

### REST Endpoints

- `GET /api/visualizations` - List all visualizations
- `POST /api/visualizations/sankey` - Create Sankey visualization
- `GET /api/visualizations/:id` - Get specific visualization
- `PUT /api/visualizations/:id` - Update visualization
- `DELETE /api/visualizations/:id` - Delete visualization
- `GET /api/health` - Health check

### WebSocket Events

- `connected` - Client connected
- `subscribe` - Subscribe to visualization updates
- `visualization_update` - Real-time data update
- `error` - Error notification

## Development

### Project Structure

```
src/
├── index.js              # Main Express server
├── mcp/                  # MCP client integration
│   └── tp-service.js     # TargetProcess service
├── api/                  # REST API endpoints
│   └── visualization.js  # Visualization endpoints
├── transformers/         # Data transformation
│   └── sankey-transformer.js
├── websocket/           # WebSocket server
│   └── index.js
└── public/              # Static assets
    ├── css/             # Stylesheets
    ├── js/              # Client-side JavaScript
    └── views/           # HTML templates
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint

### Adding New Visualization Types

1. Create transformer in `src/transformers/`
2. Add endpoint in `src/api/visualization.js`
3. Create renderer in `src/public/js/`
4. Update UI in `src/public/views/`

## Deployment

### Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Configure environment variables in Vercel dashboard

### Docker

1. Build image:
```bash
docker build -t tp-visualization-server .
```

2. Run container:
```bash
docker run -p 3000:3000 --env-file .env tp-visualization-server
```

### Traditional Hosting

1. Build for production:
```bash
npm run build
```

2. Upload files to server
3. Configure environment variables
4. Start with process manager (PM2, etc.)

## Configuration Options

### Theme Customization

Modify `src/public/css/main.css` to customize:
- Color schemes
- Typography
- Layout dimensions
- Animation timings

### Data Transformation

Customize `src/transformers/sankey-transformer.js` to:
- Change portfolio structure
- Modify value calculations
- Add custom entity types
- Adjust flow logic

### WebSocket Settings

Configure `src/websocket/index.js`:
- Connection timeouts
- Heartbeat intervals
- Client limits
- Update frequencies

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check TargetProcess credentials in `.env`
2. **No Data**: Verify TargetProcess permissions and entity access
3. **Visualization Not Loading**: Check browser console for JavaScript errors
4. **WebSocket Errors**: Ensure server supports WebSocket connections

### Debug Mode

Enable debug logging:
```bash
DEBUG=true npm run dev
```

### Health Check

Monitor system status at `/api/health`:
- TargetProcess connection
- WebSocket server
- Cache status

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Support

For issues and questions:
- Create an issue in the repository
- Check existing documentation
- Review troubleshooting guide
