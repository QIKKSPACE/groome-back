// src/routes/categoryRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

/**
 * GET /categories
 * Get all parent categories
 */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM categories
      WHERE parent_id IS NULL AND is_active = true
      ORDER BY sort_order ASC, name ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});
/**
 * GET /categories/:id/subcategories
 * Fetches ALL subcategories at ALL nested levels under the given parent ID
 */
router.get("/:id/subcategories", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      WITH RECURSIVE category_tree AS (
        -- Anchor member: direct children of the target category
        SELECT *
        FROM categories
        WHERE parent_id = $1 AND is_active = true

        UNION ALL

        -- Recursive member: all subcategories of the subcategories
        SELECT c.*
        FROM categories c
        INNER JOIN category_tree ct ON c.parent_id = ct.id
        WHERE c.is_active = true
      )
      SELECT * 
      FROM category_tree
      ORDER BY sort_order ASC, name ASC;
      `,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching nested subcategories:", err);
    res.status(500).json({ error: "Failed to fetch subcategories" });
  }
});

/**
 * OPTIONAL: full category tree (for menus)
 */
router.get("/tree/all", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM categories
      WHERE is_active = true
      ORDER BY parent_id NULLS FIRST, sort_order ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch category tree" });
  }
});

module.exports = router;