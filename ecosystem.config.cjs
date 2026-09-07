module.exports = {
  apps: [
    {
      name: "monebeauty",
      script: "npm",
      args: "run start",
      watch: false,
      autorestart: true,
      min_uptime: "10s",
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: "production",
        PORT: "5000",
      },
    },
    {
      name: "monebeauty-reminders",
      script: "npm",
      args: "run notifications:reminders",
      watch: false,
      autorestart: false,
      cron_restart: "*/30 * * * *",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
