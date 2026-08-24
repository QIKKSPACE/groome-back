const express = require("express");
const router = express.Router();
const pool = require("../config/db"); // Your PostgreSQL Pool connection

// =========================================================================
// 1. GET ALL PRICING CONFIGURATIONS & DISCOUNT TIERS
// =========================================================================
router.get("/pricing-config", async (req, res) => {
  try {
    const ratesResult = await pool.query(
      "SELECT id, position, price_per_day FROM banner_position_pricing ORDER BY id ASC"
    );

    const discountsResult = await pool.query(
      `SELECT id, min_days, max_days, discount_percentage, is_active 
       FROM banner_duration_discounts 
       WHERE is_active = TRUE 
       ORDER BY min_days ASC`
    );

    // Transform position array into a key-value object matching React state shape
    const positionRates = {
      top: "",
      middle: "",
      bottom: "",
      service: "",
    };

    ratesResult.rows.forEach((row) => {
      if (positionRates.hasOwnProperty(row.position)) {
        positionRates[row.position] = row.price_per_day;
      }
    });

    // Format discounts for frontend camelCase expectations
    const discounts = discountsResult.rows.map((d) => ({
      id: d.id,
      minDays: d.min_days,
      maxDays: d.max_days === null || d.max_days === 999 ? "" : d.max_days,
      discount: d.discount_percentage,
    }));

    res.status(200).json({
      success: true,
      data: {
        positionRates,
        discounts,
      },
    });
  } catch (err) {
    console.error("Error fetching pricing config:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// =========================================================================
// 2. SAVE / UPSERT PRICING & DISCOUNT TIERS (ATOMIC TRANSACTION)
// =========================================================================
router.post("/pricing-config", async (req, res) => {
  const client = await pool.connect();

  try {
    const { positionRates, discounts } = req.body;

    // Basic Input Validation
    if (!positionRates || !Array.isArray(discounts)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload format. Expected positionRates and discounts array.",
      });
    }

    // Begin DB Transaction
    await client.query("BEGIN");

    // A. Upsert Position Rates
    const positions = ["top", "middle", "bottom", "service"];
    for (const pos of positions) {
      const price = Number(positionRates[pos]) || 0;
      await client.query(
        `INSERT INTO banner_position_pricing (position, price_per_day, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (position) 
         DO UPDATE SET price_per_day = EXCLUDED.price_per_day, updated_at = CURRENT_TIMESTAMP`,
        [pos, price]
      );
    }

    // B. Refresh Duration Discount Tiers (Delete existing and bulk insert new)
    await client.query("DELETE FROM banner_duration_discounts");

    for (const tier of discounts) {
      const minDays = Number(tier.minDays) || 0;
      const maxDays = tier.maxDays === "" || tier.maxDays === null ? null : Number(tier.maxDays);
      const discountPct = Number(tier.discount) || 0;

      if (minDays > 0) {
        await client.query(
          `INSERT INTO banner_duration_discounts (min_days, max_days, discount_percentage, is_active)
           VALUES ($1, $2, $3, TRUE)`,
          [minDays, maxDays, discountPct]
        );
      }
    }

    // Commit Transaction
    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message: "Pricing rules updated successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving pricing config:", err);
    res.status(500).json({ success: false, message: "Failed to save pricing rules" });
  } finally {
    client.release();
  }
});

// =========================================================================
// 3. SERVER-SIDE PRICING CALCULATOR (FOR CLIENT BOOKING REQUESTS)
// =========================================================================
router.post("/calculate-quote", async (req, res) => {
  try {
    const { position, days } = req.body;

    const daysNum = Number(days) || 0;
    if (!position || daysNum <= 0) {
      return res.status(400).json({ success: false, message: "Invalid position or duration" });
    }

    // Fetch Base Rate
    const rateRes = await pool.query(
      "SELECT price_per_day FROM banner_position_pricing WHERE position = $1",
      [position]
    );

    if (rateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Position not found" });
    }

    const baseRate = Number(rateRes.rows[0].price_per_day);
    const rawTotal = baseRate * daysNum;

    // Fetch Applicable Discount Tier
    const discountRes = await pool.query(
      `SELECT discount_percentage 
       FROM banner_duration_discounts 
       WHERE is_active = TRUE 
         AND $1 >= min_days 
         AND (max_days IS NULL OR $1 <= max_days)
       ORDER BY min_days DESC 
       LIMIT 1`,
      [daysNum]
    );

    const discountPct = discountRes.rows.length > 0 ? Number(discountRes.rows[0].discount_percentage) : 0;
    const discountAmount = (rawTotal * discountPct) / 100;
    const finalTotal = rawTotal - discountAmount;

    res.status(200).json({
      success: true,
      data: {
        position,
        days: daysNum,
        baseRate,
        rawTotal,
        discountPct,
        discountAmount,
        finalTotal,
      },
    });
  } catch (err) {
    console.error("Error calculating quote:", err);
    res.status(500).json({ success: false, message: "Calculation failed" });
  }
});

module.exports = router;