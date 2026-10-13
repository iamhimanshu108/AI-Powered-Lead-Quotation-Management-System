const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../db/pool');

function sanitizeUser(user) {
  return {
    id: user.id,
    organizationId: user.organization_id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

async function seedDefaultOrganization() {
  const org = await pool.query(
    'SELECT id FROM organizations LIMIT 1'
  );

  if (org.rows.length === 0) {
    const orgResult = await pool.query(
      `INSERT INTO organizations (name, slug, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING *;`,
      [config.defaultOrgName, 'acme-sales']
    );

    const organization = orgResult.rows[0];
    const passwordHash = await bcrypt.hash(config.defaultAdminPassword, 10);

    await pool.query(
      `INSERT INTO users (organization_id, name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
      [organization.id, 'System Administrator', config.defaultAdminEmail, passwordHash, 'admin']
    );
  }
}

async function authenticate({ email, password }) {
  const normalizedEmail = String(email).trim().toLowerCase();

  if (!normalizedEmail || !password) {
    throw new Error('Email and password are required.');
  }

  const result = await pool.query(
    `SELECT id, organization_id, name, email, password_hash, role, is_active, created_at, updated_at
     FROM users
     WHERE email = $1
     LIMIT 1;`,
    [normalizedEmail]
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error('Invalid credentials.');
  }

  const isValidPassword = await bcrypt.compare(String(password), user.password_hash);

  if (!isValidPassword) {
    throw new Error('Invalid credentials.');
  }

  if (!user.is_active) {
    throw new Error('Account is disabled.');
  }

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      orgId: user.organization_id,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    token,
    user: sanitizeUser(user),
  };
}

module.exports = {
  authenticate,
  seedDefaultOrganization,
  sanitizeUser,
};
