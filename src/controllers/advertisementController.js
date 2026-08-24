const pool = require("../config/db");

// GET /api/advertisements/pricing
// Fetches both position daily rates and duration discount tiers
exports.getPricingConfig = async (req, res) => {
  try {
    const ratesQuery = `
      SELECT position, price_per_day 
      FROM banner_position_pricing;
    `;
    const discountsQuery = `
      SELECT id, min_days, max_days, discount_percentage, is_active 
      FROM banner_duration_discounts 
      WHERE is_active = TRUE 
      ORDER BY min_days ASC;
    `;

    const [ratesResult, discountsResult] = await Promise.all([
      pool.query(ratesQuery),
      pool.query(discountsQuery),
    ]);

    // Format position rates into key-value map matching React state
    const positionRates = {
      top: 0,
      middle: 0,
      bottom: 0,
      service: 0,
    };

    ratesResult.rows.forEach((row) => {
      positionRates[row.position] = parseFloat(row.price_per_day);
    });

    const discounts = discountsResult.rows.map((row) => ({
      id: row.id,
      minDays: row.min_days,
      maxDays: row.max_days === null ? 999 : row.max_days,
      discount: parseFloat(row.discount_percentage),
    }));

    return res.status(200).json({
      success: true,
      data: {
        positionRates,
        discounts,
      },
    });
  } catch (error) {
    console.error("Error fetching pricing config:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// POST /api/advertisements/pricing
// Atomic save operation for pricing rules and discount tiers
exports.savePricingConfig = async (req, res) => {
  const client = await pool.connect();
  try {
    const { positionRates, discounts } = req.body;

    await client.query("BEGIN");

    // 1. Upsert Position Daily Rates
    if (positionRates) {
      const positions = ["top", "middle", "bottom", "service"];
      for (const pos of positions) {
        if (positionRates[pos] !== undefined) {
          const price = parseFloat(positionRates[pos]) || 0.0;
          await client.query(
            `INSERT INTO banner_position_pricing (position, price_per_day, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (position) 
             DO UPDATE SET price_per_day = EXCLUDED.price_per_day, updated_at = NOW();`,
            [pos, price]
          );
        }
      }
    }

    // 2. Refresh Discount Tiers
    if (Array.isArray(discounts)) {
      // Soft-delete or truncate existing tiers before re-inserting state
      await client.query("DELETE FROM banner_duration_discounts;");

      for (const tier of discounts) {
        const minDays = parseInt(tier.minDays, 10);
        const maxDays =
          tier.maxDays === "" || tier.maxDays === 999 || tier.maxDays === null
            ? null
            : parseInt(tier.maxDays, 10);
        const discountPct = parseFloat(tier.discount) || 0.0;

        if (!isNaN(minDays)) {
          await client.query(
            `INSERT INTO banner_duration_discounts (min_days, max_days, discount_percentage)
             VALUES ($1, $2, $3);`,
            [minDays, maxDays, discountPct]
          );
        }
      }
    }

    await client.query("COMMIT");
    return res.status(200).json({
      success: true,
      message: "Pricing configuration updated successfully.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving pricing config:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  } finally {
    client.release();
  }
};

// POST /api/advertisements/calculate-quote
// Calculates exact cost, discount tier, and total on server side
exports.calculateQuote = async (req, res) => {
  try {
    const { position, days } = req.body;
    const daysNum = parseInt(days, 10);

    if (!position || isNaN(daysNum) || daysNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid position and days count (> 0) required.",
      });
    }

    // Fetch daily rate
    const rateRes = await pool.query(
      `SELECT price_per_day FROM banner_position_pricing WHERE position = $1;`,
      [position]
    );

    if (rateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Invalid position" });
    }

    const pricePerDay = parseFloat(rateRes.rows[0].price_per_day);
    const rawTotal = pricePerDay * daysNum;

    // Fetch applicable discount tier
    const discountRes = await pool.query(
      `SELECT discount_percentage 
       FROM banner_duration_discounts 
       WHERE is_active = TRUE 
         AND min_days <= $1 
         AND (max_days >= $1 OR max_days IS NULL)
       ORDER BY min_days DESC 
       LIMIT 1;`,
      [daysNum]
    );

    const discountPercentage =
      discountRes.rows.length > 0 ? parseFloat(discountRes.rows[0].discount_percentage) : 0.0;

    const discountAmount = (rawTotal * discountPercentage) / 100;
    const finalTotal = rawTotal - discountAmount;

    return res.status(200).json({
      success: true,
      data: {
        position,
        days: daysNum,
        pricePerDay,
        rawTotal,
        discountPercentage,
        discountAmount,
        finalTotal,
      },
    });
  } catch (error) {
    console.error("Error calculating quote:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};