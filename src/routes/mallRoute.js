const express = require("express");
 
 
 const router = express.Router();
const ctrl = require("../controllers/mallController");

 
 const authorization = require("../middlewares/mallAuth");
 const upload = require("../middlewares/upload"); // your multer file uploader
 const pool = require("../config/db");


 router.post("/login", ctrl.login);
 router.get("/manufacturer-products",authorization, ctrl.getManufacturerProducts);
router.post(
  "/list-product",
  authorization,
  ctrl.listProduct
);
router.post(
  "/unlist-product",
  authorization,
  ctrl.unlistProduct
);
router.get(
  "/listed-product",
  authorization,
  ctrl.getListedProducts
);
router.get("/", authorization, async (req, res) => {
  const client = await pool.connect();

  try {
    const id = req.user.mallId;

    if (!id) {
      return res.status(401).json({
        success: false,
        message: "Mall ID not found in authentication token",
      });
    }

    const mallQuery = await client.query(
      `
      SELECT
        m.*,

        u.id AS user_id,
        u.name,
        u.email,
        u.phone,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', c.id,
              'name', c.name
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'::json
        ) AS categories

      FROM malls m

      LEFT JOIN users u
        ON u.id = m.user_id

      LEFT JOIN mall_product_categories mpc
        ON mpc.mall_id = m.id

      LEFT JOIN categories c
        ON c.id = mpc.category_id

      WHERE m.id = $1

      GROUP BY
        m.id,
        u.id,
        u.name,
        u.email,
        u.phone
      `,
      [id]
    );

    if (mallQuery.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Mall not found",
      });
    }

    return res.status(200).json({
      success: true,
      mall: mallQuery.rows[0],
    });

  } catch (err) {
    console.error("❌ Get mall error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  } finally {
    client.release();
  }
});

router.put(
  "/updateMall/:id",
  authorization,
  upload.single("profile_image"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const { latitude, longitude } = req.body;

      // Check mall exists
      const mallCheck = await client.query(
        `
        SELECT id, profile_image
        FROM malls
        WHERE id = $1
        `,
        [id]
      );

      if (mallCheck.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Mall not found",
        });
      }

      const currentMall = mallCheck.rows[0];

      // Keep existing image if no new image uploaded
      let profile_image = currentMall.profile_image;

      if (req.file) {
        profile_image = `/uploads/${req.file.filename}`;
      }

      /*
       * Convert form-data values to numbers.
       * If latitude/longitude are not supplied, keep existing values.
       */
      const parsedLatitude =
        latitude !== undefined && latitude !== ""
          ? parseFloat(latitude)
          : null;

      const parsedLongitude =
        longitude !== undefined && longitude !== ""
          ? parseFloat(longitude)
          : null;

      // Validate coordinates if supplied
      if (
        (latitude !== undefined && latitude !== "" &&
          !Number.isFinite(parsedLatitude)) ||
        (longitude !== undefined && longitude !== "" &&
          !Number.isFinite(parsedLongitude))
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid latitude or longitude",
        });
      }

      if (
        parsedLatitude !== null &&
        (parsedLatitude < -90 || parsedLatitude > 90)
      ) {
        return res.status(400).json({
          success: false,
          message: "Latitude must be between -90 and 90",
        });
      }

      if (
        parsedLongitude !== null &&
        (parsedLongitude < -180 || parsedLongitude > 180)
      ) {
        return res.status(400).json({
          success: false,
          message: "Longitude must be between -180 and 180",
        });
      }

      const result = await client.query(
        `
        UPDATE malls
        SET
          profile_image = $1,

          latitude = COALESCE($2, latitude),
          longitude = COALESCE($3, longitude),

          geo_location =
            CASE
              WHEN $2 IS NOT NULL AND $3 IS NOT NULL
              THEN ST_SetSRID(
                ST_MakePoint($3, $2),
                4326
              )::geography
              ELSE geo_location
            END,

          updated_at = NOW()

        WHERE id = $4

        RETURNING *
        `,
        [
          profile_image,
          parsedLatitude,
          parsedLongitude,
          id,
        ]
      );

      return res.status(200).json({
        success: true,
        message: "Mall profile updated successfully",
        mall: result.rows[0],
      });
    } catch (error) {
      console.error("❌ Update Mall Error:", error);

      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    } finally {
      client.release();
    }
  }
);

 module.exports = router;