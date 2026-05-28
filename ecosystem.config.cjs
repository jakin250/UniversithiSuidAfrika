module.exports = {
  apps: [
    {
      name: 'universithi-suid-afrika',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
