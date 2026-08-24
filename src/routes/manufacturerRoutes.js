const express = require("express");
 
 
 const router = express.Router();
const ctrl = require("../controllers/manufacturerController");

 
 const authorization = require("../middlewares/manufacturerAuth");
 const upload = require("../middlewares/upload"); // your multer file uploader
 const pool = require("../config/db");


 router.post("/login", ctrl.login);
 router.get("/webflow",authorization, ctrl.webflow);
 router.get("/products",authorization, ctrl.getProducts);
 router.get("/products",authorization, ctrl.getProducts);
router.put(
  "/products/:id",
  authorization,
  upload.array("images", 10),
  ctrl.updateProduct
);

 router.post("/products",authorization,
     upload.array("images", 10), ctrl.createProduct);
router.delete("/products/:id",authorization, ctrl.deleteProduct);


router.get("/", authorization, async (req, res) => {
  const client = await pool.connect();

  try {
    const id = req.user.manufacturerId;

    const manufacturerQuery = await client.query(
      `
      SELECT
        m.*,

        u.id AS user_id,
        u.name,
        u.email,
        u.phone

      FROM manufacturers m

      LEFT JOIN users u
        ON u.id = m.user_id

      WHERE m.id = $1
      `,
      [id]
    );

    if (manufacturerQuery.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Manufacturer not found",
      });
    }

    return res.status(200).json({
      success: true,
      manufacturer: manufacturerQuery.rows[0],
    });

  } catch (err) {
    console.error("❌ Get manufacturer error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });

  } finally {
    client.release();
  }
});
router.put(
  "/updateProfileImage/:id",
  authorization,
  upload.single("profile_image"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { id } = req.params;

      // Only profile_image is accepted
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "profile_image is required",
        });
      }

      // Check manufacturer exists
      const manufacturerCheck = await client.query(
        `
        SELECT id, profile_image
        FROM manufacturers
        WHERE id = $1
        `,
        [id]
      );

      if (manufacturerCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Manufacturer not found",
        });
      }

      // New profile image path
      const profile_image = `/uploads/${req.file.filename}`;

      // Update ONLY profile_image
      const result = await client.query(
        `
        UPDATE manufacturers
        SET
          profile_image = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *;
        `,
        [profile_image, id]
      );

      return res.status(200).json({
        success: true,
        message: "Manufacturer profile image updated successfully",
        manufacturer: result.rows[0],
      });

    } catch (error) {
      console.error("Update Manufacturer Profile Image Error:", error);

      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });

    } finally {
      client.release();
    }
  }
);
 module.exports=router;
