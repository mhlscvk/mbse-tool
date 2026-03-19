// PM2 ecosystem config — ensures correct cwd so dotenv finds .env files.
// Usage: pm2 start ecosystem.config.cjs
// See: https://pm2.keymetrics.io/docs/usage/application-declaration/
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'dist/index.js',
      cwd: './packages/api-server',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'lsp',
      script: 'dist/index.js',
      cwd: './packages/lsp-server',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'diagram',
      script: 'dist/index.js',
      cwd: './packages/diagram-service',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
