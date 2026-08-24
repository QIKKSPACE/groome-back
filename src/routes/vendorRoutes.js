// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/vendorController");
const ctrlProdut = require("../controllers/vendorProductController");

const superadminAuth = require("../middlewares/vendorAuth");
const upload = require("../middlewares/upload"); // your multer file uploader
const pool = require("../config/db");
// GET /auth/check-username?username=...

//post /auth/login
router.post("/login", ctrl.login);
router.get("/webflow",superadminAuth, ctrl.webflow);


router.get("/services",superadminAuth, ctrl.getServices);

router.post("/settings",superadminAuth, ctrl.saveVendorSettings);
router.delete("/services/:serviceId",superadminAuth, ctrl.deleteService);

router.post("/services",superadminAuth,
    upload.array("images", 10), // upload up to 10 files
    ctrl.createServices);

router.put(
  "/services/:serviceId",
  superadminAuth,
  upload.array("images", 10),
  ctrl.updateService
);

router.get("/products",superadminAuth, ctrlProdut.getProducts);

router.post("/products",superadminAuth,
    upload.array("images", 10), // upload up to 10 files
    ctrlProdut.createProduct);

router.put(
  "/products/:id",
  superadminAuth,
  upload.array("images", 10),
  ctrlProdut.updateProduct
);
router.delete("/products/:id",superadminAuth, ctrlProdut.deleteProduct);
router.get("/",superadminAuth,async (req, res) => {

const client = await pool.connect();

  try {
  const id = req.user.vendorId;
   

    const vendorQuery = await client.query(
      `
      SELECT
        v.*,

        u.id as user_id,
        u.name,
        u.email,
        u.phone,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', s.id,
              'name', s.name
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) as services,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', pc.id,
              'name', pc.name
            )
          ) FILTER (WHERE pc.id IS NOT NULL),
          '[]'
        ) as categories

      FROM vendors v

      LEFT JOIN users u
        ON u.id = v.user_id

      LEFT JOIN vendor_services vs
        ON vs.vendor_id = v.id

      LEFT JOIN services s
        ON s.id = vs.service_id

      LEFT JOIN vendor_product_categories vpc
        ON vpc.vendor_id = v.id

      LEFT JOIN categories pc
        ON pc.id = vpc.category_id

      WHERE v.id = $1

      GROUP BY
        v.id,
        u.id,
        u.name,
        u.email,
        u.phone
      `,
      [id]
    );

    if (vendorQuery.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      success: true,
      vendor: vendorQuery.rows[0],
    });
  } catch (err) {
    console.error("❌ Get vendor error:", err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  } finally {
    client.release();
  }
});

router.put(
  "/updateVendor/:id",
  superadminAuth,
  upload.single("profile_image"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const {
        latitude,
        longitude,
        delivery_radius_km,
          why_choose_us,
            is_delay_active,
  delay_time_minutes,
      } = req.body;

      // Check vendor exists
      const vendorCheck = await client.query(
        `SELECT id, profile_image FROM vendors WHERE id = $1`,
        [id]
      );

      if (vendorCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Vendor not found",
        });
      }

      let profile_image = vendorCheck.rows[0].profile_image;

      // New image uploaded
      if (req.file) {
        profile_image = `/uploads/${req.file.filename}`;
      }

    const result = await client.query(
  `
  UPDATE vendors
  SET
    profile_image = COALESCE($1, profile_image),
    latitude = COALESCE($2, latitude),
    longitude = COALESCE($3, longitude),
    delivery_radius_km = COALESCE($4, delivery_radius_km),
    why_choose_us = COALESCE($5::jsonb, why_choose_us),
    is_delay_active = COALESCE($6, is_delay_active),
    delay_time_minutes = COALESCE($7, delay_time_minutes),
    updated_at = NOW()
  WHERE id = $8
  RETURNING *
  `,
  [
    profile_image,
    latitude || null,
    longitude || null,
    delivery_radius_km || null,
    why_choose_us
      ? JSON.stringify(
          Array.isArray(why_choose_us)
            ? why_choose_us
            : [why_choose_us]
        )
      : null,

    // Convert form-data strings to proper types
    is_delay_active !== undefined
      ? is_delay_active === "true"
      : null,

    delay_time_minutes !== undefined
      ? parseInt(delay_time_minutes, 10)
      : null,

    id,
  ]
);

      return res.status(200).json({
        success: true,
        message: "Vendor profile updated successfully",
        vendor: result.rows[0],
      });
    } catch (error) {
      console.error("Update Vendor Error:", error);

      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    } finally {
      client.release();
    }
  }
);
 
router.post(
  "/blocked-slot",
 superadminAuth,async (req, res) => {
    const vendorId = req.user.vendorId;
  const { blockedTimings } = req.body;

  const client = await pool.connect();

  try {
    if (!Array.isArray(blockedTimings)) {
      return res.status(400).json({
        message: "blockedTimings must be an array"
      });
    }

    await client.query("BEGIN");

    // Replace all existing blocked slots
    await client.query(
      `
      DELETE FROM blocked_slots
      WHERE vendor_id = $1
      `,
      [vendorId]
    );

    for (const slot of blockedTimings) {
      const { date, start, end } = slot;

      if (!date || !start || !end) {
        continue;
      }

      await client.query(
        `
        INSERT INTO blocked_slots
        (
          vendor_id,
          blocked_date,
          start_time,
          end_time
        )
        VALUES ($1,$2,$3,$4)
        `,
        [
          vendorId,
          date,
          start,
          end
        ]
      );
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Blocked timings saved"
    });

  } catch (err) {
    await client.query("ROLLBACK");

    console.error(err);

    return res.status(500).json({
      message: "Failed to save blocked timings"
    });
  } finally {
    client.release();
  }

 });
module.exports = router;
