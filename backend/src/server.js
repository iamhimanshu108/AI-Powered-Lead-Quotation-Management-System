const app = require('./app');
const config = require('./config');
const fs = require('fs/promises');
const path = require('path');
const { pool } = require('./db/pool');
const { seedDefaultOrganization } = require('./services/auth.service');

async function startServer() {
  try {
    await pool.query('SELECT 1;');
    console.log('Database connected successfully.');

    const schemaPath = path.join(__dirname, '../migrations/001_init_schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('Database schema is ready.');

    await seedDefaultOrganization();
    app.listen(config.port, () => {
      console.log(`Backend server started at http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error(
      'Failed to start backend application:',
      error instanceof Error ? error.message || error : error
    );
    process.exit(1);
  }
}

startServer();
