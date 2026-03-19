// PM2 ecosystem config — ensures correct cwd so dotenv finds .env files.
// Usage: pm2 start ecosystem.config.cjs
// See: https://pm2.keymetrics.io/docs/usage/application-declaration/
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'dist/index.js',
      cwd: './packages/api-server',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'diagram',
      script: 'dist/index.js',
      cwd: './packages/diagram-service',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
