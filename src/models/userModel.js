// src/models/userModel.js
const pool = require("../config/db");

async function createUser({ username, email, passwordHash }) {
  const sql = `
    INSERT INTO users (username, email, password_hash)
    VALUES ($1, $2, $3)
    RETURNING id, username, email, is_verified, created_at
  `;
  const values = [username, email, passwordHash];
  const { rows } = await pool.query(sql, values);
  return rows[0];
}

async function getUserByEmail(email) {
  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return rows[0];
}
async function getUserByPhone(phone) {
  const { rows } = await pool.query("SELECT * FROM users WHERE phone = $1", [phone]);
  return rows[0];
}
async function getUserByUsername(username) {
  const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
  return rows[0];
}

async function getUserById(id) {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0];
}

async function setVerified(userId) {
  const { rows } = await pool.query(
    "UPDATE users SET is_verified = true, updated_at = NOW() WHERE id = $1 RETURNING id, username, email, is_verified",
    [userId]
  );
  return rows[0];
}

module.exports = {
  createUser,
  getUserByPhone,
  getUserByEmail,
  getUserByUsername,
  getUserById,
  setVerified,
};
