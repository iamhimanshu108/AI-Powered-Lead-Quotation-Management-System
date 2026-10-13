const { Pool } = require('pg');
const config = require('../config');

const poolConfig = config.db.connectionString
  ? {
      connectionString: config.db.connectionString,
      ...(config.db.ssl ? { ssl: config.db.ssl } : {}),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error:', err.message);
});

module.exports = { pool };
