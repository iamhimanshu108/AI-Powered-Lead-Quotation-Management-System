process.env.JWT_SECRET = 'test-secret';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/pool');

jest.mock('../src/db/pool', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const adminToken = jwt.sign({
  sub: '11111111-1111-1111-1111-111111111111',
  email: 'admin@example.com',
  orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  role: 'admin',
}, 'test-secret');

const salespersonToken = jwt.sign({
  sub: '22222222-2222-2222-2222-222222222222',
  email: 'sales@example.com',
  orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  role: 'sales_executive',
}, 'test-secret');

describe('Organization and sales management routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires authentication to read leads', async () => {
    const response = await request(app).get('/api/leads');

    expect(response.statusCode).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns dashboard metrics scoped to the authenticated organization', async () => {
    pool.query.mockResolvedValue({
      rows: [{
        total_leads: 2,
        qualified_leads: 1,
        open_leads: 2,
        follow_ups_today: 0,
        active_users: 3,
      }],
    });

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${salespersonToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.stats.qualified_leads).toBe(1);
    expect(pool.query.mock.calls[0][1]).toEqual(['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
  });

  it('allows an admin to update organization details', async () => {
    const organization = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Northstar Sales',
      slug: 'northstar-sales',
    };
    pool.query.mockResolvedValue({ rows: [organization] });

    const response = await request(app)
      .patch('/api/organization')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Northstar Sales' });

    expect(response.statusCode).toBe(200);
    expect(response.body.organization.name).toBe('Northstar Sales');
    expect(pool.query.mock.calls[0][1]).toEqual(['Northstar Sales', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
  });

  it('creates a team member with a hashed password', async () => {
    const createdUser = {
      id: '33333333-3333-3333-3333-333333333333',
      organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'New Salesperson',
      email: 'new@example.com',
      role: 'sales_executive',
      is_active: true,
    };
    pool.query.mockResolvedValue({ rows: [createdUser] });

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'New Salesperson',
        email: 'NEW@example.com',
        password: 'temporary-password-1',
        role: 'sales_executive',
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.user.email).toBe('new@example.com');
    expect(response.body.user).not.toHaveProperty('password_hash');
    expect(await bcrypt.compare('temporary-password-1', pool.query.mock.calls[0][1][3])).toBe(true);
  });

  it('prevents non-admin users from changing organization details', async () => {
    const response = await request(app)
      .patch('/api/organization')
      .set('Authorization', `Bearer ${salespersonToken}`)
      .send({ name: 'Not allowed' });

    expect(response.statusCode).toBe(403);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns only basic teammate fields to non-admin users', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: '33333333-3333-3333-3333-333333333333', name: 'Sales teammate', is_active: true }],
    });

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${salespersonToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.users[0]).not.toHaveProperty('email');
    expect(pool.query.mock.calls[0][0]).toContain('WHERE organization_id = $1');
    expect(pool.query.mock.calls[0][1]).toEqual(['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
  });

  it('creates leads scoped to the authenticated organization', async () => {
    const lead = {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      lead_number: 'LD-20261013-A1B2C3',
      company_name: 'Example Co',
      status: 'new',
      priority: 'medium',
    };
    pool.query.mockResolvedValue({ rows: [lead] });

    const response = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${salespersonToken}`)
      .send({ companyName: 'Example Co' });

    expect(response.statusCode).toBe(201);
    expect(response.body.lead.company_name).toBe('Example Co');
    expect(pool.query.mock.calls[0][1][0]).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(pool.query.mock.calls[0][1][2]).toBe('22222222-2222-2222-2222-222222222222');
  });

  it('rejects invalid lead values before querying the database', async () => {
    const response = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${salespersonToken}`)
      .send({ companyName: '', priority: 'urgent' });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Validation failed.');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('records an activity only when the lead belongs to the user organization', async () => {
    pool.query.mockResolvedValue({
      rows: [{
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        lead_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        activity_type: 'note',
        details: 'Follow-up scheduled',
      }],
    });

    const response = await request(app)
      .post('/api/leads/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/activities')
      .set('Authorization', `Bearer ${salespersonToken}`)
      .send({ activityType: 'note', details: 'Follow-up scheduled' });

    expect(response.statusCode).toBe(201);
    expect(pool.query.mock.calls[0][0]).toContain('l.organization_id = $1');
    expect(pool.query.mock.calls[0][1]).toEqual([
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '22222222-2222-2222-2222-222222222222',
      'note',
      'Follow-up scheduled',
    ]);
  });
});
