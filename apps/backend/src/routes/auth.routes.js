const express = require("express");
const { z } = require("zod");
const { authenticate } = require("../services/auth.service");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

router.post("/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await authenticate(payload);
    return res.status(200).json(result);
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed.",
        errors: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    if (
      error.message === "Invalid credentials." ||
      error.message === "Account is disabled." ||
      error.message === "Email and password are required."
    ) {
      return res.status(401).json({ message: error.message });
    }

    return next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  return res.status(200).json({ user: req.user });
});

router.post("/logout", (req, res) => {
  return res.status(200).json({ message: "Logged out successfully." });
});

module.exports = router;
