const app = require('./app');
const config = require('./config');
const { pool } = require('./db/pool');
const { seedDefaultOrganization } = require('./services/auth.service');

async function startServer() {
  try {
    await pool.query('SELECT 1;');
    await seedDefaultOrganization();
    app.listen(config.port, () => {
      console.log(`Lead quotation backend running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start backend application:', error.message);
    process.exit(1);
  }
}

startServer();
