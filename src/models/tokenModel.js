// src/models/tokenModel.js

const pool = require("../config/db");

// save a refresh token for a user
async function saveRefreshToken(userId, token, userType) {
  if (!userId || !token || !userType) {
    throw new Error("userId, token and userType are required");
  }

  const query = `
    INSERT INTO refresh_tokens (
      user_id,
      token,
      user_type,
      created_at
    )
    VALUES ($1, $2, $3, NOW())
    RETURNING *;
  `;

  const values = [userId, token, userType];

  const { rows } = await pool.query(query, values);

  return rows[0];
}


// get a refresh token record
async function getRefreshToken(token, userType) {
  if (!token || !userType) {
    throw new Error("token and userType are required");
  }

  const query = `
    SELECT *
    FROM refresh_tokens
    WHERE token = $1
      AND user_type = $2;
  `;

  const { rows } = await pool.query(query, [
    token,
    userType,
  ]);

  return rows[0];
}


// delete a refresh token
async function deleteRefreshToken(token, userType) {
  if (!token || !userType) {
    throw new Error("token and userType are required");
  }

  const query = `
    DELETE FROM refresh_tokens
    WHERE token = $1
      AND user_type = $2;
  `;

  await pool.query(query, [
    token,
    userType,
  ]);
}


module.exports = {
  saveRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
};