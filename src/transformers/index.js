// Transformers index - Export all data transformers
const { SankeyTransformer } = require('./sankey-transformer');

// Factory function to create transformers
function createTransformer(type, options = {}) {
  switch (type) {
    case 'sankey':
      return new SankeyTransformer(options.theme);
    default:
      throw new Error(`Unknown transformer type: ${type}`);
  }
}

// Convenience function for Sankey transformation
function transformToSankey(rawData, options = {}) {
  const transformer = new SankeyTransformer(options.theme);
  return transformer.transform(rawData, options);
}

module.exports = {
  SankeyTransformer,
  createTransformer,
  transformToSankey
};