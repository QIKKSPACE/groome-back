const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/getAllUsers", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.affiliate_code,
        u.parent_affiliate,
        u.affiliate_count,
        u.affiliate_count,

        CASE
          WHEN p.id IS NOT NULL THEN
            json_build_object(
              'id', p.id,
              'name', p.name,
              'email', p.email,
              'phone', p.phone,
              'affiliate_code', p.affiliate_code,
              'affiliate_count', p.affiliate_count
            )
          ELSE NULL
        END AS parent_user

      FROM users u
      LEFT JOIN users p
        ON u.parent_affiliate = p.id

      ORDER BY u.affiliate_count DESC, u.name ASC;
    `);

    res.json({
      success: true,
      count: result.rows.length,
      users: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users.",
    });
  }
});

router.post("/assignAffiliate", async (req, res) => {
  const { userId, affiliateId } = req.body;

  if (!userId || !affiliateId) {
    return res.status(400).json({
      success: false,
      message: "userId and affiliateId are required.",
    });
  }

  if (userId === affiliateId) {
    return res.status(400).json({
      success: false,
      message: "A user cannot be their own affiliate.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check child user
    const childResult = await client.query(
      `SELECT id, parent_affiliate
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (childResult.rows.length === 0) {
      throw new Error("User not found.");
    }

    if (childResult.rows[0].parent_affiliate) {
      throw new Error("User already has a parent affiliate.");
    }

    // Check parent user
    const parentResult = await client.query(
      `SELECT id, affiliate_count
       FROM users
       WHERE id = $1`,
      [affiliateId]
    );

    if (parentResult.rows.length === 0) {
      throw new Error("Affiliate user not found.");
    }

    // Update child's parent
    await client.query(
      `UPDATE users
       SET parent_affiliate = $1
       WHERE id = $2`,
      [affiliateId, userId]
    );

    // Increment parent's affiliate_count
    await client.query(
      `UPDATE users
       SET affiliate_count = COALESCE(affiliate_count, 0) + 1
       WHERE id = $1`,
      [affiliateId]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Affiliate assigned successfully.",
    });
  } catch (err) {
    await client.query("ROLLBACK");

    res.status(400).json({
      success: false,
      message: err.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;