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




module.exports = router;
