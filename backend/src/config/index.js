const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
const useDatabaseUrl = Boolean(databaseUrl);

const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'development-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  db: useDatabaseUrl
    ? {
        connectionString: databaseUrl,
        ...(process.env.NODE_ENV === 'production'
          ? { ssl: { rejectUnauthorized: false } }
          : {}),
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || 'lead_quotation_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      },
  defaultOrgName: process.env.DEFAULT_ORG_NAME || 'Acme Sales',
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || 'admin@acme.local',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!',
};

module.exports = config;
