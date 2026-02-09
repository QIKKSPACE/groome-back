// src/models/verificationModel.js
const pool = require("../config/db");

async function insertCode({ userId, code, purpose, expiresAt }) {
  const sql = `
    INSERT INTO verification_codes (user_id, code, purpose, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_id, code, purpose, expires_at, created_at
  `;
  const values = [userId, code, purpose, expiresAt];
  const { rows } = await pool.query(sql, values);
  return rows[0];
}

async function findValidCodeByUserAndCode(userId, code, purpose) {
  const sql = `
    SELECT * FROM verification_codes
    WHERE user_id = $1 AND code = $2 AND purpose = $3 AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [userId, code, purpose]);
  return rows[0];
}

async function deleteCodesForUserPurpose(userId, purpose) {
  return pool.query("DELETE FROM verification_codes WHERE user_id = $1 AND purpose = $2", [userId, purpose]);
}

module.exports = {
  insertCode,
  findValidCodeByUserAndCode,
  deleteCodesForUserPurpose,
};
