module.exports = {
  apps: [{
    name: "kooperative-frontend",
    script: "app/.output/server/index.mjs",
    node_args: "-r dotenv/config",
    env_file: ".env" 
  }]
}