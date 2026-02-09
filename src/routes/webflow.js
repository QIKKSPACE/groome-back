// routes/webflow.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db"); // your db connection
router.get("/", async (req, res) => {
  try {
    const [
      banners,
      services,
      categories,
      franchiseTypes,
      cities,
      creators
    ] = await Promise.all([
      pool.query("SELECT * FROM banners ORDER BY created_at DESC"),
      pool.query("SELECT * FROM services ORDER BY id ASC"),
      pool.query("SELECT * FROM categories ORDER BY sort_order ASC"),
      pool.query("SELECT * FROM franchise_types ORDER BY id ASC"),
      pool.query("SELECT * FROM city_lists ORDER BY id ASC"),
      pool.query(`
        SELECT DISTINCT ON (i.id)
          i.id,
          i.name,
          i.booking_price,
          i.about_you,
          i.show_on_frontend,

          v.id AS video_id,
          v.video_url

        FROM influencers i
        LEFT JOIN influencer_videos v
          ON v.influencer_id = i.id

        WHERE i.show_on_frontend = true
        ORDER BY i.id, v.created_at DESC
      `)
    ]);

    return res.json({
      banners: banners.rows,
      services: services.rows,
      categories: categories.rows,
      franchise_types: franchiseTypes.rows,
      city_list: cities.rows,
      creators: creators.rows
    });
  } catch (error) {
    console.error("❌ Webflow data fetch failed:", error);
    return res.status(500).json({ message: "Failed to fetch webflow data" });
  }
});


module.exports = router;
