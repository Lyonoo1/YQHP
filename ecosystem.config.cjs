module.exports = {
  apps: [
    {
      name: 'yqhp',
      script: 'node_modules/.bin/tsx',
      args: 'server.ts',
      instances: 1, // 数据持久化在本地 data/park-hupu-db.json，必须单实例运行
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3108,
        BASE_PATH: '/yqhp',
      },
    },
  ],
};
