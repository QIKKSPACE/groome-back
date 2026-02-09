// src/models/tokenModel.js
const pool = require("../config/db"); // your Postgres pool or client

// save a refresh token for a user
async function saveRefreshToken(userId, token) {
  const query = `
    INSERT INTO refresh_tokens (user_id, token, created_at)
    VALUES ($1, $2, NOW())
    RETURNING *;
  `;
  const values = [userId, token];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

// get a refresh token record
async function getRefreshToken(token) {
  const query = `
    SELECT * FROM refresh_tokens WHERE token = $1;
  `;
  const { rows } = await pool.query(query, [token]);
  return rows[0];
}

// delete a refresh token
async function deleteRefreshToken(token) {
  const query = `
    DELETE FROM refresh_tokens WHERE token = $1;
  `;
  await pool.query(query, [token]);
}

module.exports = { saveRefreshToken, getRefreshToken, deleteRefreshToken };
