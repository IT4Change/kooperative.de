module.exports = {
  apps: [{
    name: "kooperative-frontend",
    cwd: "./app",
    script: ".output/server/index.mjs",
    node_args: "-r dotenv/config",
    env_file: ".env"
  }]
}