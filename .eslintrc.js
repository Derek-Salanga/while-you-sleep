module.exports = {
  extends: ['expo', 'prettier'],
  ignorePatterns: ['/dist/*', 'node_modules/*', '.expo/*'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
