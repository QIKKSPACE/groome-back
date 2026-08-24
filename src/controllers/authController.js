// src/controllers/authController.js
const userModel = require("../models/userModel");
const verificationModel = require("../models/verificationModel");
const { hashPassword, comparePassword } = require("../utils/hash");
const { generateCode } = require("../utils/generateCode");
const emailService = require("../services/emailService");
const jwt = require("jsonwebtoken");
const { saveRefreshToken, getRefreshToken, deleteRefreshToken } = require("../models/tokenModel");
const pool = require("../config/db");
const admin = require("../firebase");
const VERIFICATION_EXP_MINUTES = 10;
// controllers/authController.js

const crypto = require("crypto");

// helper to generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// helper to generate 8–10 character alphanumeric affiliate code
const generateAffiliateCode = () => {
  const timestamp = Date.now().toString().slice(-6); // last 6 digits
  const random = crypto.randomInt(1000, 9999); // 4 digits

  return `GRO_${timestamp}${random}`;
};

const verifyOtp = async (req, res) => {
  try {
    const { phone, name, email, parent_affiliate, otp, password } = req.body;

    if (!phone || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number and OTP are required" });
    }

    // 1. Validate OTP
    if (otp !== "100001") {
      return res
        .status(401)
        .json({ success: false, message: "Invalid OTP. Please try again." });
    }

    // 2. Check if user already exists
    const existingUserResult = await pool.query(
      "SELECT * FROM users WHERE phone = $1",
      [phone]
    );

    if (existingUserResult.rows.length > 0) {
      const user = existingUserResult.rows[0];

      // Generate tokens for existing user
      const accessToken = jwt.sign(
        { userId: user.id, phone: user.phone },
        process.env.JWT_SECRET,
        { expiresIn: "1m" }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "1y" }
      );

      return res.status(200).json({
        success: true,
        message: "User already verified.",
        user,
        accessToken,
        refreshToken,
      });
    }

    // 3. Hash password
    const passwordHash = await hashPassword(password || "TEMP_PASS");

    // 4. Create affiliate code
    const affiliateCode = generateAffiliateCode();

    // 5. Insert new user
    const newUserQuery = `
      INSERT INTO users 
        (name, email, phone, password, role, affiliate_code, parent_affiliate, is_affiliate)
      VALUES ($1, $2, $3, $4, $5, $6, $7, false)
      RETURNING id, name, email, phone, affiliate_code, parent_affiliate;
    `;
    const values = [
      name || "User",
      email || `${phone}@example.com`,
      phone,
      passwordHash,
      "customer",
      affiliateCode,
      parent_affiliate || null,
    ];

    const newUserResult = await pool.query(newUserQuery, values);
    const newUser = newUserResult.rows[0];

    // 6. Generate JWT tokens
    const accessToken = jwt.sign(
      { userId: newUser.id, phone: newUser.phone },
      process.env.JWT_SECRET,
      { expiresIn: "1m" }
    );

    const refreshToken = jwt.sign(
      { userId: newUser.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "1y" }
    );

    return res.status(201).json({
      success: true,
      message: "Account verified and created successfully.",
      user: newUser,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("verifyOtp error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};


// -------------------- EXISTING SIGNUP FLOW --------------------
function normalizeIndianPhone(phone) {
  if (!phone) return null;

  // +91XXXXXXXXXX → XXXXXXXXXX
  if (phone.startsWith("+91")) {
    return phone.slice(3);
  }

  return phone;
}

async function signup(req, res) {
  const client = await pool.connect();

  try {
    const { firebaseToken, name, email, password, parent_affiliate } = req.body;

    if (!firebaseToken || !password) {
      return res.status(400).json({
        success: false,
        message: "Firebase token and password are required",
      });
    }

    // 1️⃣ Verify Firebase token
    const decoded = await admin.auth().verifyIdToken(firebaseToken);

    const rawPhone = decoded.phone_number;
    const phone = normalizeIndianPhone(rawPhone);
    const firebaseUid = decoded.uid;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number not verified",
      });
    }

    // Start transaction
    await client.query("BEGIN");

    // 2️⃣ Check if user already exists
    const existingUser = await client.query(
      `SELECT * FROM users WHERE phone = $1 OR email = $2`,
      [phone, email || null]
    );

    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");

      const user = existingUser.rows[0];

      const accessToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "1y" }
      );

      return res.status(200).json({
        success: true,
        message: "User already exists",
        user,
        accessToken,
        refreshToken,
      });
    }

    // 3️⃣ Hash password
    const passwordHash = await hashPassword(password);

    // 4️⃣ Generate affiliate code
    const affiliateCode = generateAffiliateCode();

    // 5️⃣ Resolve parent affiliate
    let parentAffiliateId = null;

    if (parent_affiliate) {
      const parentResult = await client.query(
        `SELECT id FROM users WHERE affiliate_code = $1`,
        [parent_affiliate]
      );

      if (parentResult.rows.length > 0) {
        parentAffiliateId = parentResult.rows[0].id;
      }
    }

    // 6️⃣ Insert new user
    const result = await client.query(
      `
      INSERT INTO users
      (name, email, phone, password, role, affiliate_code, parent_affiliate, firebase_uid)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING
        id,
        name,
        email,
        phone,
        affiliate_code,
        parent_affiliate,
        affiliate_count;
      `,
      [
        name || "User",
        email || null,
        phone,
        passwordHash,
        "customer",
        affiliateCode,
        parentAffiliateId,
        firebaseUid,
      ]
    );

    const newUser = result.rows[0];

    // 7️⃣ Increment parent's affiliate count
    if (parentAffiliateId) {
      await client.query(
        `
        UPDATE users
        SET affiliate_count = affiliate_count + 1
        WHERE id = $1
        `,
        [parentAffiliateId]
      );
    }

    // Commit transaction
    await client.query("COMMIT");

    // 8️⃣ Generate tokens
    const accessToken = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { userId: newUser.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "1y" }
    );

    return res.status(201).json({
      success: true,
      message: "Signup successful",
      user: newUser,
      accessToken,
      refreshToken,
    });

  } catch (err) {
    await client.query("ROLLBACK");

    console.error("Signup error:", err);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired Firebase token",
    });
  } finally {
    client.release();
  }
}

// -------------------- LOGIN FLOW --------------------
async function login(req, res) {
  try {
    const { phone, password } = req.body;
    if (![phone] || !password)
      return res.status(400).json({ message: "email/username and password required" });

    const input = phone.trim();
    let user = await userModel.getUserByPhone(phone);
    if (!user) return res.status(401).json({ message: "No user Found" });

    const valid = await comparePassword(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "1y" }
    );

    await saveRefreshToken(user.id, refreshToken,"USER");

    return res.json({ 
      user: { id: user.id, name: user.name, email: user.email,  is_affiliate: user.is_affiliate,
    affiliate_code: user.affiliate_code, },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ message: "server error" });
  }
}

// -------------------- REFRESH TOKEN --------------------
async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

    const tokenRecord = await getRefreshToken(refreshToken);
    if (!tokenRecord) return res.status(403).json({ message: "Invalid refresh token" });

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await userModel.getUserById(decoded.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newAccessToken = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    const newRefreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    await deleteRefreshToken(refreshToken,"USER");
    await saveRefreshToken(user.id, newRefreshToken,"USER");

    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error("refresh token error:", err);
    return res.status(403).json({ message: "Invalid or expired refresh token" });
  }
}

// -------------------- LOGOUT --------------------
async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    await deleteRefreshToken(refreshToken,"USER");
    return res.json({ success: true });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ message: "server error" });
  }
}

module.exports = {
  
  signup,
  
  login,
  refresh,
  logout,
  verifyOtp
};
