process.env.JWT_SECRET = "test-secret";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../src/app");
const { pool } = require("../src/db/pool");

jest.mock("../src/db/pool", () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe("Authentication routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs in a valid user and returns a JWT", async () => {
    const passwordHash = await bcrypt.hash("Admin123!", 10);
    pool.query.mockResolvedValue({
      rows: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          name: "System Administrator",
          email: "admin@acme.local",
          password_hash: passwordHash,
          role: "admin",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "admin@acme.local",
      password: "Admin123!",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.email).toBe("admin@acme.local");
    expect(response.body.user.role).toBe("admin");
  });

  it("rejects invalid credentials with a 401-style error payload", async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const response = await request(app).post("/api/auth/login").send({
      email: "admin@acme.local",
      password: "WrongPassword123!",
    });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe("Invalid credentials.");
  });

  it("returns the authenticated user profile", async () => {
    const token = jwt.sign(
      {
        sub: "11111111-1111-1111-1111-111111111111",
        email: "admin@acme.local",
        orgId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        role: "admin",
      },
      "test-secret",
      { expiresIn: "8h" },
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.user.email).toBe("admin@acme.local");
    expect(response.body.user.role).toBe("admin");
  });
});
