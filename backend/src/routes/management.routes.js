const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const { pool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const adminOnly = [requireAuth, requireRole('admin')];
const roleSchema = z.enum(['admin', 'sales_manager', 'sales_executive']);
const prioritySchema = z.enum(['low', 'medium', 'high']);
const statusSchema = z.enum(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']);
const nullableText = (max) => z.string().trim().max(max).nullable().optional();

const organizationUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  password: z.string().min(10).max(128),
  role: roleSchema,
});

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().email().max(255).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

const leadFields = {
  companyName: z.string().trim().min(1).max(255),
  contactName: nullableText(255),
  email: z.union([z.string().trim().email().max(255), z.literal(''), z.null()]).optional(),
  phone: nullableText(50),
  address: nullableText(10000),
  leadSource: nullableText(100),
  interest: nullableText(255),
  requirementDescription: nullableText(10000),
  estimatedBudget: z.union([z.number().finite().nonnegative(), z.null()]).optional(),
  expectedClosingDate: z.union([z.string().date(), z.null()]).optional(),
  assignedSalespersonId: z.union([z.string().uuid(), z.null()]).optional(),
  priority: prioritySchema.optional(),
  status: statusSchema.optional(),
  followUpNotes: nullableText(10000),
  nextFollowUpAt: z.union([z.string().datetime({ offset: true }), z.null()]).optional(),
};

const createLeadSchema = z.object(leadFields);
const updateLeadSchema = createLeadSchema.partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');
const activitySchema = z.object({
  activityType: z.string().trim().min(1).max(80),
  details: z.string().trim().max(10000).nullable().optional(),
});

const leadColumnMap = {
  companyName: 'company_name',
  contactName: 'contact_name',
  email: 'email',
  phone: 'phone',
  address: 'address',
  leadSource: 'lead_source',
  interest: 'interest',
  requirementDescription: 'requirement_description',
  estimatedBudget: 'estimated_budget',
  expectedClosingDate: 'expected_closing_date',
  assignedSalespersonId: 'assigned_salesperson_id',
  priority: 'priority',
  status: 'status',
  followUpNotes: 'follow_up_notes',
  nextFollowUpAt: 'next_follow_up_at',
};

const userColumnMap = {
  name: 'name',
  email: 'email',
  isActive: 'is_active',
};

function handleRouteError(error, next) {
  if (error.code === '23505') {
    return next(Object.assign(new Error('A record with that email or slug already exists.'), { statusCode: 409 }));
  }
  return next(error);
}

function parsedBody(schema, req, res) {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      message: 'Validation failed.',
      errors: result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
    });
    return null;
  }
  return result.data;
}

function mapFields(value, columns) {
  return Object.entries(value).map(([key, entry]) => [columns[key], entry]);
}

async function ensureAssignedUser(organizationId, userId) {
  if (!userId) return;
  const result = await pool.query(
    'SELECT 1 FROM users WHERE id = $1 AND organization_id = $2 AND is_active = TRUE',
    [userId, organizationId]
  );
  if (result.rowCount === 0) {
    throw Object.assign(new Error('Assigned salesperson must be an active user in your organization.'), { statusCode: 400 });
  }
}

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS total_leads,
         COUNT(*) FILTER (WHERE status = 'qualified')::int AS qualified_leads,
         COUNT(*) FILTER (WHERE status NOT IN ('won', 'lost'))::int AS open_leads,
         COUNT(*) FILTER (WHERE next_follow_up_at::date = CURRENT_DATE)::int AS follow_ups_today,
         (SELECT COUNT(*)::int FROM users WHERE organization_id = $1 AND is_active = TRUE) AS active_users
       FROM leads
       WHERE organization_id = $1`,
      [req.user.organizationId]
    );
    res.json({ stats: result.rows[0] });
  } catch (error) {
    handleRouteError(error, next);
  }
});

router.get('/organization', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, slug, created_at, updated_at FROM organizations WHERE id = $1',
      [req.user.organizationId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Organization not found.' });
    return res.json({ organization: result.rows[0] });
  } catch (error) {
    return handleRouteError(error, next);
  }
});

router.patch('/organization', ...adminOnly, async (req, res, next) => {
  const input = parsedBody(organizationUpdateSchema, req, res);
  if (!input) return;
  try {
    const fields = mapFields(input, { name: 'name', slug: 'slug' });
    const values = fields.map(([, value]) => value);
    values.push(req.user.organizationId);
    const assignments = fields.map(([column], index) => `${column} = $${index + 1}`);
    const result = await pool.query(
      `UPDATE organizations SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, name, slug, created_at, updated_at`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Organization not found.' });
    return res.json({ organization: result.rows[0] });
  } catch (error) {
    return handleRouteError(error, next);
  }
});

router.get('/users', requireAuth, async (req, res, next) => {
  try {
    const columns = req.user.role === 'admin'
      ? 'id, name, email, role, is_active, created_at, updated_at'
      : 'id, name, is_active';
    const result = await pool.query(
      `SELECT ${columns} FROM users WHERE organization_id = $1 ORDER BY created_at DESC`,
      [req.user.organizationId]
    );
    return res.json({ users: result.rows });
  } catch (error) {
    return handleRouteError(error, next);
  }
});

router.post('/users', ...adminOnly, async (req, res, next) => {
  const input = parsedBody(createUserSchema, req, res);
  if (!input) return;
  try {
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(input.password, 12);
    const result = await pool.query(
      `INSERT INTO users (organization_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, organization_id, name, email, role, is_active, created_at, updated_at`,
      [req.user.organizationId, input.name, input.email.toLowerCase(), passwordHash, input.role]
    );
    return res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    return handleRouteError(error, next);
  }
});

router.patch('/users/:id', ...adminOnly, async (req, res, next) => {
  const input = parsedBody(updateUserSchema, req, res);
  if (!input) return;
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) return res.status(400).json({ message: 'Invalid user ID.' });
  if (req.params.id === req.user.id && input.isActive === false) {
    return res.status(400).json({ message: 'You cannot deactivate your own account.' });
  }
  try {
    const fields = mapFields(input, userColumnMap);
    const values = fields.map(([column, value]) => column === 'email' ? value.toLowerCase() : value);
    values.push(req.params.id, req.user.organizationId);
    const assignments = fields.map(([column], index) => `${column} = $${index + 1}`);
    const result = await pool.query(
      `UPDATE users SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length - 1} AND organization_id = $${values.length}
       RETURNING id, organization_id, name, email, role, is_active, created_at, updated_at`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'User not found.' });
    return res.json({ user: result.rows[0] });
  } catch (error) {
    return handleRouteError(error, next);
  }
});

router.get('/leads', requireAuth, async (req, res, next) => {
  const querySchema = z.object({
    search: z.string().trim().max(200).optional(),
    status: statusSchema.optional(),
  });
  const query = querySchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: 'Invalid lead filters.' });
  try {
    const result = await pool.query(
      `SELECT l.id, l.lead_number, l.company_name, l.contact_name, l.email, l.phone,
              l.address, l.lead_source, l.interest, l.requirement_description,
              l.estimated_budget, l.expected_closing_date, l.assigned_salesperson_id,
              l.priority, l.status, l.follow_up_notes, l.next_follow_up_at,
              l.created_at, l.updated_at, u.name AS assigned_salesperson_name
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_salesperson_id
       WHERE l.organization_id = $1
         AND ($2::text IS NULL OR l.status = $2)
         AND ($3::text IS NULL OR l.company_name ILIKE '%' || $3 || '%'
              OR COALESCE(l.contact_name, '') ILIKE '%' || $3 || '%'
              OR COALESCE(l.email, '') ILIKE '%' || $3 || '%')
       ORDER BY l.updated_at DESC`,
      [req.user.organizationId, query.data.status || null, query.data.search || null]
    );
    return res.json({ leads: result.rows });
  } catch (error) {
    return handleRouteError(error, next);
  }
});

router.post('/leads', requireAuth, async (req, res, next) => {
  const input = parsedBody(createLeadSchema, req, res);
  if (!input) return;
  try {
    await ensureAssignedUser(req.user.organizationId, input.assignedSalespersonId);
    const fields = mapFields(input, leadColumnMap);
    const columnNames = fields.map(([column]) => column);
    const values = fields.map(([, value]) => value === '' ? null : value);
    const leadNumber = `LD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const result = await pool.query(
      `INSERT INTO leads (organization_id, lead_number, created_by, ${columnNames.join(', ')})
       VALUES ($${values.length + 1}, $${values.length + 2}, $${values.length + 3}, ${values.map((_, index) => `$${index + 4}`).join(', ')})
       RETURNING *`,
      [req.user.organizationId, leadNumber, req.user.id, ...values]
    );
    return res.status(201).json({ lead: result.rows[0] });
  } catch (error) {
    return handleRouteError(error, next);
  }
});

router.patch('/leads/:id', requireAuth, async (req, res, next) => {
  const input = parsedBody(updateLeadSchema, req, res);
  if (!input) return;
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) return res.status(400).json({ message: 'Invalid lead ID.' });
  try {
    await ensureAssignedUser(req.user.organizationId, input.assignedSalespersonId);
    const fields = mapFields(input, leadColumnMap);
    const values = fields.map(([, value]) => value === '' ? null : value);
    values.push(req.params.id, req.user.organizationId);
    const assignments = fields.map(([column], index) => `${column} = $${index + 1}`);
    const result = await pool.query(
      `UPDATE leads SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length - 1} AND organization_id = $${values.length}
       RETURNING *`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Lead not found.' });
    return res.json({ lead: result.rows[0] });
  } catch (error) {
    return handleRouteError(error, next);
  }
});

router.get('/leads/:id/activities', requireAuth, async (req, res, next) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) return res.status(400).json({ message: 'Invalid lead ID.' });
  try {
    const result = await pool.query(
      `SELECT a.id, a.activity_type, a.details, a.created_at, u.name AS user_name
       FROM lead_activities a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.lead_id = $1 AND a.organization_id = $2
       ORDER BY a.created_at DESC`,
      [req.params.id, req.user.organizationId]
    );
    return res.json({ activities: result.rows });
  } catch (error) {
    return handleRouteError(error, next);
  }
});

router.post('/leads/:id/activities', requireAuth, async (req, res, next) => {
  const input = parsedBody(activitySchema, req, res);
  if (!input) return;
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) return res.status(400).json({ message: 'Invalid lead ID.' });
  try {
    const result = await pool.query(
      `INSERT INTO lead_activities (organization_id, lead_id, user_id, activity_type, details)
       SELECT $1, l.id, $3, $4, $5 FROM leads l
       WHERE l.id = $2 AND l.organization_id = $1
       RETURNING id, lead_id, activity_type, details, created_at`,
      [req.user.organizationId, req.params.id, req.user.id, input.activityType, input.details || null]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Lead not found.' });
    return res.status(201).json({ activity: result.rows[0] });
  } catch (error) {
    return handleRouteError(error, next);
  }
});

module.exports = router;
