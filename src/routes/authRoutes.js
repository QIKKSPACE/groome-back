// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/authController");
const pool = require("../config/db");
const { hashPassword, comparePassword } = require("../utils/hash");
const admin = require("firebase-admin");
// GET /auth/check-username?username=...
router.post("/verifyOtp", ctrl.verifyOtp);


// POST /auth/signup
router.post("/signup", ctrl.signup);

// POST /auth/verify-signup

//post /auth/login
router.post("/login", ctrl.login);
router.post("/pre-signup", async (req, res) => {
  const { email, phone } = req.body;

  if (!email || !phone) {
    return res.status(400).json({ message: "Email and phone required" });
  }

  try {
    const result = await pool.query(
      `SELECT id 
       FROM users 
       WHERE email = $1 OR phone = $2 
       LIMIT 1`,
      [email, phone]
    );

    if (result.rows.length > 0) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    return res.status(200).json({ success: true, message: "Phone number already registered" });

  } catch (err) {
    console.error("Pre-signup error:", err);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.post("/check-user", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ exists: false, message: "Phone is required" });
    }

    // Example: check in database
    const client = await pool.connect();
    const query = "SELECT id FROM users WHERE phone = $1 LIMIT 1";
    const result = await client.query(query, [phone]);
    client.release();

    if (result.rows.length > 0) {
      return res.json({ exists: true, message: "User exists" });
    } else {
      return res.json({ exists: false, message: "User does not exist" });
    }
  } catch (err) {
    console.error("Check user error:", err);
    return res.status(500).json({ exists: false, message: "Server error" });
  }
});
router.post("/reset-password", async (req, res) => {
  try {
    const { firebaseToken, password } = req.body;

    if (!firebaseToken || !password) {
      return res.status(400).json({
        success: false,
        message: "Firebase token and password are required",
      });
    }

    // 1️⃣ Verify Firebase token
    const decoded = await admin.auth().verifyIdToken(firebaseToken);
    const phone = decoded.phone_number;
    const firebaseUid = decoded.uid;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number not verified",
      });
    }

    // 2️⃣ Hash new password
    const passwordHash = await hashPassword(password);

    // 3️⃣ Update user password in DB
    const updateQuery = `
      UPDATE users
      SET password = $1
      WHERE firebase_uid = $2
      RETURNING id, name, email, phone;
    `;

    const result = await pool.query(updateQuery, [passwordHash, firebaseUid]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });

  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
});
module.exports = router;
