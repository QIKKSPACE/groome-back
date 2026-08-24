// src/routes/productRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

/**
 * GET /products
 * Query params:
 * - categoryId
 * - subcategoryId
 * - page
 * - limit
 */
router.get("/", async (req, res) => {
  try {
    const {
      categoryId,
      subcategoryId,
      page = 1,
      limit = 12,
    } = req.query;

    const offset = (page - 1) * limit;

    const values = [];
    let where = `WHERE p.status = 'active'`;

    // category filter
    if (categoryId) {
      values.push(categoryId);
      where += ` AND p.category_id = $${values.length}`;
    }

    // subcategory filter
    if (subcategoryId) {
      values.push(subcategoryId);
      where += ` AND p.sub_category_id = $${values.length}`;
    }

    values.push(limit);
    values.push(offset);

    const query = `
      SELECT
        p.*,

        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'image_url', pi.image_url,
              'is_primary', pi.is_primary
            ) ORDER BY pi.is_primary DESC, pi.sort_order ASC
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) AS images

      FROM products p
     JOIN vendors v
ON v.user_id = p.user_id
AND v.verified = true
      LEFT JOIN product_images pi
        ON pi.product_id = p.id

      ${where}

      GROUP BY p.id

      ORDER BY p.created_at DESC

      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `;

    const result = await pool.query(query, values);

    // total count for pagination
    const countQuery = `
      SELECT COUNT(*) FROM products p ${where}
    `;

    const countResult = await pool.query(
      countQuery,
      values.slice(0, values.length - 2)
    );

    const total = parseInt(countResult.rows[0].count, 10);

    res.json({
      products: result.rows,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

module.exports = router;