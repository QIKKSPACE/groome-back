const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const fs = require("fs");
const path = require("path");
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        i.id,
        i.name,
        i.booking_price,
        i.about_you,
        i.instagram_profile

        COALESCE(
          json_agg(
            json_build_object(
              'id', v.id,
              'video_url', v.video_url,
              'created_at', v.created_at
            )
            ORDER BY v.created_at DESC
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'
        ) AS videos

      FROM influencers i
      LEFT JOIN influencer_videos v
        ON v.influencer_id = i.id

      WHERE i.id = $1
      GROUP BY i.id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Influencer not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/updateBookingPrice/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { booking_price } = req.body;

    // Validation
    if (!booking_price || isNaN(booking_price)) {
      return res.status(400).json({
        success: false,
        message: "Valid booking_price is required",
      });
    }

    const result = await pool.query(
      `
      UPDATE influencers
      SET booking_price = $1
      WHERE id = $2
      RETURNING id, name, booking_price
      `,
      [booking_price, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Influencer not found",
      });
    }

    return res.json({
      success: true,
      message: "Booking price updated successfully",
      influencer: result.rows[0],
    });
  } catch (error) {
    console.error("Update booking price error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});


router.delete(
  "/:influencerId/videos/:video_id",
  async (req, res) => {
    const { influencerId, video_id } = req.params;

    try {
      // 1️⃣ Fetch video record
      const videoResult = await pool.query(
        `
        SELECT video_url
        FROM influencer_videos
        WHERE id = $1 AND influencer_id = $2
        `,
        [video_id, influencerId]
      );

      if (videoResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Video not found",
        });
      }

      const videoUrl = videoResult.rows[0].video_url;

      // 2️⃣ Delete file from uploads
      const filePath = path.join(
        __dirname,
        "..",
        videoUrl // e.g. /uploads/videos/abc.mp4
      );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // 3️⃣ Delete DB record
      await pool.query(
        `
        DELETE FROM influencer_videos
        WHERE id = $1 AND influencer_id = $2
        `,
        [video_id, influencerId]
      );

      return res.json({
        success: true,
        message: "Video deleted successfully",
      });
    } catch (error) {
      console.error("Delete video error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);
module.exports = router;
