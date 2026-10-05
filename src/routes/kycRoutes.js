
const express = require("express");
const router = express.Router();

const authorization = require("../middlewares/manufacturerAuth");
const pool = require("../config/db");
const upload = require("../middlewares/upload");
router.post(
  "/",
  authorization,
  upload.fields([
    { name: "pan_image", maxCount: 1 },
    { name: "document_front", maxCount: 1 },
    { name: "document_back", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userId = req.user.manufacturerId || req.user.vendorId || req.user.mallId;

      const {
        account_holder_name,
        account_number,
        ifsc,
        pan_number,
        document_type,
        other_type,
      } = req.body;

      const panImage = req.files?.pan_image?.[0];
      const documentFront = req.files?.document_front?.[0];
      const documentBack = req.files?.document_back?.[0];

      // Validate required fields...
      if (
        !account_holder_name ||
        !account_number ||
        !ifsc ||
        !pan_number ||
        !document_type ||
        !other_type
      ) {
        return res.status(400).json({
          success: false,
          message: "All required KYC fields are required",
        });
      }

      // Check if a KYC record already exists for this user
      const existingKycQuery = `SELECT * FROM kyc WHERE user_id = $1 AND other_type = $2`;
      const existingKyc = await pool.query(existingKycQuery, [userId, other_type]);

      // Handle file paths (keep old ones if new files aren't uploaded during resubmission)
      let panImageUrl = panImage ? `/uploads/${panImage.filename}` : null;
      let documentFrontUrl = documentFront ? `/uploads/${documentFront.filename}` : null;
      let documentBackUrl = documentBack ? `/uploads/${documentBack.filename}` : null;

      if (existingKyc.rows.length > 0) {
        // RESUBMISSION CASE: Update the existing record
        const current = existingKyc.rows[0];

        panImageUrl = panImageUrl || current.pan_image_url;
        documentFrontUrl = documentFrontUrl || current.document_front_url;
        documentBackUrl = documentBackUrl || current.document_back_url;

        const updateQuery = `
          UPDATE kyc SET
            account_holder_name = $1,
            account_number = $2,
            ifsc = $3,
            pan_number = $4,
            pan_image_url = $5,
            document_type = $6,
            document_front_url = $7,
            document_back_url = $8,
            status = 'PENDING',
            rejection_reason = NULL,
            verified_at = NULL,
            verified_by = NULL,
            updated_at = NOW()
          WHERE user_id = $9 AND other_type = $10
          RETURNING *;
        `;

        const updateValues = [
          account_holder_name,
          account_number,
          ifsc,
          pan_number,
          panImageUrl,
          document_type,
          documentFrontUrl,
          documentBackUrl,
          userId,
          other_type,
        ];

        const result = await pool.query(updateQuery, updateValues);

        return res.status(200).json({
          success: true,
          message: "KYC resubmitted successfully",
          kyc: result.rows[0],
        });

      } else {
        // FIRST-TIME SUBMISSION CASE: Insert new record
        if (!panImage || !documentFront) {
          return res.status(400).json({
            success: false,
            message: "PAN and Document front images are required for initial submission",
          });
        }

        const insertQuery = `
          INSERT INTO kyc (
            user_id, other_type, account_holder_name, account_number, ifsc, 
            pan_number, pan_image_url, document_type, document_front_url, 
            document_back_url, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING')
          RETURNING *;
        `;

        const insertValues = [
          userId,
          other_type,
          account_holder_name,
          account_number,
          ifsc,
          pan_number,
          panImageUrl,
          document_type,
          documentFrontUrl,
          documentBackUrl,
        ];

        const result = await pool.query(insertQuery, insertValues);

        return res.status(201).json({
          success: true,
          message: "KYC submitted successfully",
          kyc: result.rows[0],
        });
      }
    } catch (error) {
      console.error("KYC submission error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to submit KYC",
      });
    }
  }
);
router.get(
  "/",
  authorization,
  async (req, res) => {
    try {
 const userId = req.user.manufacturerId || req.user.vendorId || req.user.mallId; // Adjust based on your authentication middleware

      const query = `
        SELECT
          id,
          user_id,
          other_type,
          account_holder_name,
          account_number,
          ifsc,
          pan_number,
          pan_image_url,
          document_type,
          document_front_url,
          document_back_url,
          status,
          rejection_reason,
          verified_at,
          verified_by,
          created_at,
          updated_at
        FROM kyc
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1;
      `;

      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        return res.status(200).json({
          success: true,
          kyc: null,
          message: "KYC not submitted yet",
        });
      }

      return res.status(200).json({
        success: true,
        kyc: result.rows[0],
      });
    } catch (error) {
      console.error("Get KYC error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch KYC",
      });
    }
  }
);

module.exports = router;
