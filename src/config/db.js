// src/config/db.js
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,             // max connections in pool
  idleTimeoutMillis: 30000, // close idle clients after 30s
  connectionTimeoutMillis: 2000, // return error after 2s if no connection
});

// Optional: test connection once
pool.connect()
  .then((client) => {
    console.log("✅ Connected to PostgreSQL via pool");
    client.release();
  })
  .catch((err) => {
    console.error("❌ Database connection error:", err.stack);
    process.exit(1);
  });

module.exports = pool;
