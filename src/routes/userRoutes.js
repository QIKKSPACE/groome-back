// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/userController");
const ctrl1 = require("../controllers/calculateSlotController");
const ctrl2= require("../controllers/createBookingController");
const superadminAuth = require("../middlewares/auth");
const authorization = require("../middlewares/auth");
const pool = require("../config/db");



// GET /auth/check-username?username=...
router.get("/allService", ctrl.getAllServicesWithImages);
router.get(
  "/services/category/:category",
  ctrl.getAllServicesWithImagesByCategory
);
router.get("/services/:id", ctrl.getServiceById);
router.get("/calculateSlot/:serviceId", ctrl1.calculateSlots);
router.post("/bookings",authorization, ctrl2.createBooking);

router.post("/accept_affiliate", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "User ID required" });

  try {
    const result = await pool.query(
      `UPDATE users
       SET is_affiliate = true
       WHERE id = $1
       RETURNING affiliate_code`,
      [userId]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    return res.json({ affiliate_code: result.rows[0].affiliate_code });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});


router.get("/all-user-under-affiliate/:affiliateCode", async (req, res) => {
  const { affiliateCode } = req.params;
  if (!affiliateCode) return res.status(400).json({ message: "Affiliate code required" });

  try {
    const result = await pool.query(
      `SELECT id, name, email, phone
       FROM users
       WHERE parent_affiliate = $1
       ORDER BY created_at DESC`,
      [affiliateCode]
    );

    return res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const productResult = await pool.query(
      `
      SELECT
        p.*,
        c.name AS category_name,
        sc.name AS sub_category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN categories sc ON sc.id = p.sub_category_id
      WHERE p.id = $1
      `,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const imagesResult = await pool.query(
      `
      SELECT *
      FROM product_images
      WHERE product_id = $1
      ORDER BY created_at;
      `,
      [id]
    );

    res.json({
      success: true,
      product: {
        ...productResult.rows[0],
        images: imagesResult.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});


module.exports = router;
