// src/controllers/authController.js
const userModel = require("../models/userModel");
const verificationModel = require("../models/verificationModel");
const { hashPassword, comparePassword } = require("../utils/hash");
const { generateCode } = require("../utils/generateCode");
const emailService = require("../services/emailService");
const jwt = require("jsonwebtoken");
const { saveRefreshToken, getRefreshToken, deleteRefreshToken } = require("../models/tokenModel");
const pool = require("../config/db");
const path = require("path");
const fs = require("fs");
const VERIFICATION_EXP_MINUTES = 10;
// controllers/authController.js

const crypto = require("crypto");

// helper to generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// -------------------- LOGIN FLOW --------------------
async function login(req, res) {
  try {
    const { phone, password, } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "Phone and password required" });
    }

    const inputPhone = phone.trim();

    // 1️⃣ Check if user exists
    const user = await userModel.getUserByPhone(inputPhone);
    if (!user) {
      return res.status(401).json({ message: "No user found" });
    }

    // 2️⃣ Validate password
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 3️⃣ Check if vendor exists for this user
    const { rows: vendorRows } = await pool.query(
      `SELECT * FROM vendors WHERE user_id = $1`,
      [user.id]
    );

    if (!vendorRows.length) {
      return res.status(403).json({ message: "Vendor not onboarded" });
    }

    const vendor = vendorRows[0];

    // 4️⃣ Check if vendor is verified
    if (!vendor.verified ) {
      return res.status(403).json({ message: "Vendor not verified  please wait for verification to complete" });
    }

    // 5️⃣ Create tokens
    const accessToken = jwt.sign(
      { userId: user.id, vendorId: vendor.id, businessName: vendor.business_name },
      process.env.ACCESS_TOKEN_VENDOR,
      { expiresIn: "1d" }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "1y" }
    );

    await saveRefreshToken(user.id, refreshToken,"VENDOR");

    // 6️⃣ Send response with essential vendor info
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      vendor: {
        id: vendor.id,
        businessName: vendor.business_name,
        gstNumber: vendor.gst_number,
        address: vendor.address,
        city: vendor.city,
        state: vendor.state,
        pincode: vendor.pincode,
        deliveryRadiusKm: vendor.delivery_radius_km,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// server/routes/vendors.ts

// GET /vendors/webflow/:vendorId
async function webflow(req, res) {
  const vendorId = req.user.vendorId;
  const weeklyDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  try {
    const [
      settingsResult,
      closedResult,
      holidayResult,
      blockedSlotsResult,
      extraResult,
      servicesResult,
      categoriesResult
    ] = await Promise.all([
      pool.query(
        `SELECT * FROM vendor_settings WHERE vendor_id = $1`,
        [vendorId]
      ),
      pool.query(
        `SELECT id, day_date, reason
         FROM closed_days
         WHERE vendor_id = $1
         ORDER BY day_date`,
        [vendorId]
      ),
      pool.query(
        `SELECT id, start_date, end_date, reason
         FROM holiday_ranges
         WHERE vendor_id = $1
         ORDER BY start_date`,
        [vendorId]
      ),
        pool.query(
    `SELECT
        id,
        blocked_date,
        start_time,
        end_time,
        reason
     FROM blocked_slots
     WHERE vendor_id = $1
     ORDER BY blocked_date,start_time`,
    [vendorId]
  ),
      pool.query(
        `SELECT id, day_date, start_time, end_time
         FROM overtimes
         WHERE vendor_id = $1
         ORDER BY day_date`,
        [vendorId]
      ),
      
      pool.query(`SELECT * FROM services ORDER BY id ASC`),
      pool.query(`SELECT * FROM categories ORDER BY sort_order ASC`)
    ]);

    const vendorSettingsDb = settingsResult.rows[0] || null;

    const vendorSettings = vendorSettingsDb
      ? {
         businessHours: {
  open: vendorSettingsDb.open_time,
  close: vendorSettingsDb.close_time,
  slotDuration: String(vendorSettingsDb.slot_duration ?? 30),
},
          weeklyOffDays: (vendorSettingsDb.weekly_off_days || [])
            .map(d => weeklyDays[d])
            .filter(Boolean),
          employeeCount: vendorSettingsDb.employee_count || 1,
          autoGenerateSlots: vendorSettingsDb.auto_generate_slots ?? true,
          timezone: vendorSettingsDb.timezone || "UTC",
        }
      : null;

    const closedDays = closedResult.rows.map(c => ({
      id: c.id,
      day_date:
        c.day_date instanceof Date
          ? c.day_date.toISOString().split("T")[0]
          : c.day_date,
      reason: c.reason || "",
    }));

    const holidayRanges = holidayResult.rows.map(h => ({
      id: h.id,
      from:
        h.start_date instanceof Date
          ? h.start_date.toISOString().split("T")[0]
          : h.start_date,
      to:
        h.end_date instanceof Date
          ? h.end_date.toISOString().split("T")[0]
          : h.end_date,
      reason: h.reason || "",
    }));

    const extraHours = extraResult.rows.map(e => ({
      id: e.id,
      date:
        e.day_date instanceof Date
          ? e.day_date.toISOString().split("T")[0]
          : e.day_date,
      start: e.start_time,
      end: e.end_time,
    }));
const blockedTimings = blockedSlotsResult.rows.map(slot => ({
  id: slot.id,
  date:
    slot.blocked_date instanceof Date
      ? slot.blocked_date.toISOString().split("T")[0]
      : slot.blocked_date,
  start: slot.start_time,
  end: slot.end_time,
  reason: slot.reason || ""
}));
    return res.json({
      vendorSettings,
      closedDays,
      holidayRanges,
      extraHours,
        blockedTimings,
      services: servicesResult.rows,
      categories: categoriesResult.rows,
    });
  } catch (err) {
    console.error("Error fetching vendor webflow:", err);
    return res.status(500).json({
      message: "Failed to load vendor data",
    });
  }
}

async function saveVendorSettings(req, res) {
  const vendorId = req.user.vendorId;
  const { vendorSettings, closedDays, extraHours, holidayRanges } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Update vendor_settings
    if (vendorSettings) {
      const { businessHours, weeklyOffDays, employeeCount } = vendorSettings;
      const slotDurationNum = Number(businessHours.slotDuration ?? 30);
      await client.query(
        `
        INSERT INTO vendor_settings (vendor_id, open_time, close_time, weekly_off_days, employee_count,slot_duration, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, now())
        ON CONFLICT (vendor_id) DO UPDATE
        SET open_time = EXCLUDED.open_time,
            close_time = EXCLUDED.close_time,
            weekly_off_days = EXCLUDED.weekly_off_days,
            employee_count = EXCLUDED.employee_count,
            slot_duration = EXCLUDED.slot_duration,
            updated_at = now()
        `,
        [
          vendorId,
          businessHours.open,
          businessHours.close,
          weeklyOffDays.map(d => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(d)), // convert to smallint[]
          employeeCount,
          slotDurationNum
        ]
      );
    }

    // 2️⃣ Replace closed_days for today or new closed days
    if (Array.isArray(closedDays)) {
      // Optionally delete previous entries for the same dates
      for (const day of closedDays) {
        await client.query(
          `
          INSERT INTO closed_days (vendor_id, day_date, reason)
          VALUES ($1, $2, $3)
          ON CONFLICT (vendor_id, day_date) DO UPDATE SET reason = EXCLUDED.reason
          `,
          [vendorId, day.day_date, day.reason || null]
        );
      }
    }

    // 3️⃣ Replace extra hours / overtimes
    if (Array.isArray(extraHours)) {
      for (const e of extraHours) {
        await client.query(
          `
          INSERT INTO overtimes (vendor_id, day_date, start_time, end_time)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (vendor_id, day_date) DO UPDATE
          SET start_time = EXCLUDED.start_time,
              end_time = EXCLUDED.end_time
          `,
          [vendorId, e.date, e.start, e.end]
        );
      }
    }

    // 4️⃣ Replace holiday ranges
    if (Array.isArray(holidayRanges)) {
      for (const h of holidayRanges) {
        await client.query(
          `
          INSERT INTO holiday_ranges (vendor_id, start_date, end_date, reason)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (vendor_id, start_date, end_date) DO UPDATE
          SET reason = EXCLUDED.reason
          `,
          [vendorId, h.from, h.to, h.reason || null]
        );
      }
    }

    await client.query("COMMIT");
    return res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving vendor settings:", err);
    return res.status(500).json({ message: "Failed to save vendor settings" });
  } finally {
    client.release();
  }
}
async function getServices (req, res)  {
try {
const vendorId = req.user.vendorId; // extracted from JWT middleware

if (!vendorId) {
return res.status(403).json({ error: "Vendor access only." });
}

const query = `
SELECT 
  s.id,
  s.vendor_id,
  s.category_id,
  s.name,
  s.description,
  s.price,
  s.discount_price,
  s.duration_minutes,
  s.status,
  s.created_at,
  s.updated_at,
  COALESCE(json_agg(json_build_object(
    'id', si.id,
    'image_url', si.image_url,
    'sort_order', si.sort_order
  ) ORDER BY si.sort_order) FILTER (WHERE si.id IS NOT NULL), '[]') AS images
FROM services_main s
LEFT JOIN service_images si ON s.id = si.service_id
WHERE s.vendor_id = $1
GROUP BY s.id
ORDER BY s.created_at DESC;
`;

const result = await pool.query(query, [vendorId]);

res.json({
success: true,
services: result.rows,
});
} catch (err) {
console.error("Error fetching vendor services:", err);
res.status(500).json({ error: "Server error fetching vendor services" });
}
}
   async function getServices (req, res)  {
  try {
    const vendorId = req.user.vendorId; // extracted from JWT middleware

    if (!vendorId) {
      return res.status(403).json({ error: "Vendor access only." });
    }

    const query = `
      SELECT 
        s.id,
        s.vendor_id,
        s.category_id,
        s.name,
        s.description,
        s.price,
        s.discount_price,
        s.duration_minutes,
        s.status,
        s.created_at,
        s.updated_at,
        COALESCE(json_agg(json_build_object(
          'id', si.id,
          'image_url', si.image_url,
          'sort_order', si.sort_order
        ) ORDER BY si.sort_order) FILTER (WHERE si.id IS NOT NULL), '[]') AS images
      FROM services_main s
      LEFT JOIN service_images si ON s.id = si.service_id
      WHERE s.vendor_id = $1
      GROUP BY s.id
      ORDER BY s.created_at DESC;
    `;

    const result = await pool.query(query, [vendorId]);

    res.json({
      success: true,
      services: result.rows,
    });
  } catch (err) {
    console.error("Error fetching vendor services:", err);
    res.status(500).json({ error: "Server error fetching vendor services" });
  }
}
async function createServices (req, res)  {
  const client = await pool.connect();

try {
const vendorId = req.user.vendorId; // extracted from JWT middleware

 const {
        name,
        description,
        category_id,
        price,
        discount_price,
        duration_minutes,
        status,
        quality_tier
      } = req.body;

      if (!vendorId) {
        return res.status(403).json({ error: "Vendor access only." });
      }

      await client.query("BEGIN");

      // Insert into services_main
      const serviceQuery = `
        INSERT INTO services_main 
        (vendor_id, category_id, name, description, price, discount_price, duration_minutes, status,quality_tier)
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'active'),$9)
        RETURNING *;
      `;

      const serviceResult = await client.query(serviceQuery, [
        vendorId,
        category_id || null,
        name,
        description || null,
        price,
        discount_price || null,
        duration_minutes || 60,
        status,
        quality_tier
      ]);

      const service = serviceResult.rows[0];

      // Insert service_images if images exist
      if (req.files && req.files.length > 0) {
        const imageQuery = `
          INSERT INTO service_images (service_id, image_url, sort_order)
          VALUES ($1, $2, $3) RETURNING *;
        `;

        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];

          await client.query(imageQuery, [
            service.id,
            `/uploads/${file.filename}`, // public URL path
            i,
          ]);
        }
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Service created successfully",
        service,
      });
  } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error creating service:", err);
      res.status(500).json({ error: "Server error creating service" });
    } finally {
      client.release();
    }
}
async function deleteService(req, res) {
  const client = await pool.connect();

  try {
    const vendorId = req.user.vendorId; // from JWT
    const { serviceId } = req.params;
    console.log(serviceId)
    if (!vendorId) {
      return res.status(403).json({ error: "Vendor access only." });
    }

    await client.query("BEGIN");

    // 1️⃣ Check ownership
    const checkQuery = `
      SELECT * FROM services_main 
      WHERE id = $1 AND vendor_id = $2
      LIMIT 1;
    `;
    const checkResult = await client.query(checkQuery, [serviceId, vendorId]);

    if (checkResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Service not found ." });
    }

    // 2️⃣ Fetch images for deletion
    const imgQuery = `
      SELECT * FROM service_images WHERE service_id = $1;
    `;
    const imgResult = await client.query(imgQuery, [serviceId]);

    // 3️⃣ Delete images from DB
    await client.query(`DELETE FROM service_images WHERE service_id = $1`, [
      serviceId,
    ]);

    // 4️⃣ Delete service
    await client.query(`DELETE FROM services_main WHERE id = $1`, [serviceId]);

    await client.query("COMMIT");

    // 5️⃣ Delete image files from disk
    imgResult.rows.forEach((img) => {
      const filePath = path.join(__dirname, "..", img.image_url);
      fs.unlink(filePath, (err) => {
        if (err) console.log("File not found:", filePath);
      });
    });

    return res.json({
      success: true,
      message: "Service deleted successfully",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting service:", err);
    return res.status(500).json({ error: "Server error deleting service" });
  } finally {
    client.release();
  }
}
async function updateService(req, res) {
  const client = await pool.connect();

  try {
    const vendorId = req.user.vendorId;
    const { serviceId } = req.params;

    const {
      name,
      description,
      category_id,
      price,
      discount_price,
      duration_minutes,
      status,
    } = req.body;

    await client.query("BEGIN");

    // Verify service belongs to vendor
    const serviceCheck = await client.query(
      `
      SELECT *
      FROM services_main
      WHERE id = $1 AND vendor_id = $2
      `,
      [serviceId, vendorId]
    );

    if (serviceCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "Service not found",
      });
    }

    // Update service
    const updateResult = await client.query(
      `
      UPDATE services_main
      SET
        category_id = $1,
        name = $2,
        description = $3,
        price = $4,
        discount_price = $5,
        duration_minutes = $6,
        status = $7,
        updated_at = NOW()
      WHERE id = $8
      RETURNING *;
      `,
      [
        category_id || null,
        name,
        description || null,
        price,
        discount_price || null,
        duration_minutes || 60,
        status || "active",
        serviceId,
      ]
    );

    const service = updateResult.rows[0];

    // If new images uploaded
    if (req.files && req.files.length > 0) {
      // Delete old image records
      await client.query(
        `DELETE FROM service_images WHERE service_id = $1`,
        [serviceId]
      );

      // Insert new images
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        await client.query(
          `
          INSERT INTO service_images
          (service_id, image_url, sort_order)
          VALUES ($1, $2, $3)
          `,
          [
            serviceId,
            `/uploads/${file.filename}`,
            i,
          ]
        );
      }
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Service updated successfully",
      service,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating service:", err);

    return res.status(500).json({
      error: "Server error updating service",
    });
  } finally {
    client.release();
  }
}
module.exports = {
  deleteService,
  createServices,
  getServices,
  saveVendorSettings,
  updateService,
  login,
  webflow

};
