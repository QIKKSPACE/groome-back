const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");
const authorization = require("../middlewares/auth");
const upload = require("../middlewares/advupload");

// ============================================
// SAFELY PARSE FORMDATA ARRAYS
// ============================================
const parseArray = (value) => {
  if (!value) return [];

  // Multer parsed array
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  // Stringified JSON array or single value
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter(Boolean);
      }
      if (parsed !== null && parsed !== undefined) {
        return [String(parsed).trim()].filter(Boolean);
      }
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }

  return [];
};

// Helper to cleanup uploaded files on error/validation failure
const safeUnlink = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error("Failed to delete temp file:", err);
    });
  }
};

// ============================================
// CREATE ADVERTISEMENT CAMPAIGN
// ============================================
router.post(
  "/create-campaign",
  authorization,
  upload.single("banner"),
  async (req, res) => {
    let client;

    try {
      const { position, startDate, endDate, targetLink, title } = req.body;

      // 1. Authenticate Advertiser
      const advertiserId =
        req.user?.id || req.user?.userId || req.user?.user_id;

      if (!advertiserId) {
        if (req.file) safeUnlink(req.file.path);
        return res.status(401).json({
          success: false,
          error: "User authentication failed.",
        });
      }

      // 2. Validate Banner File
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Banner image is required.",
        });
      }

      // 3. Validate Basic Fields
      if (!position || !startDate || !endDate) {
        safeUnlink(req.file.path);
        return res.status(400).json({
          success: false,
          error: "Position, start date, and end date are required.",
        });
      }

      // 4. Validate Target Link
      if (!targetLink || !targetLink.trim()) {
        safeUnlink(req.file.path);
        return res.status(400).json({
          success: false,
          error: "Target link is required.",
        });
      }

      try {
        const parsedUrl = new URL(targetLink.trim());
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Invalid protocol");
        }
      } catch {
        safeUnlink(req.file.path);
        return res.status(400).json({
          success: false,
          error: "Target link must be a valid HTTP or HTTPS URL.",
        });
      }

      // 5. Validate Date Ranges
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T00:00:00`);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        safeUnlink(req.file.path);
        return res.status(400).json({
          success: false,
          error: "Invalid start date or end date format.",
        });
      }

      if (end < start) {
        safeUnlink(req.file.path);
        return res.status(400).json({
          success: false,
          error: "End date cannot be before start date.",
        });
      }

      // 6. Location Isolation Logic (Pincode > Tehsil > City > State > Country)
      const pincodes = parseArray(req.body.pincodes);
      const tehsils = parseArray(req.body.tehsils);
      const cities = parseArray(req.body.cities);
      const states = parseArray(req.body.states);
      const countries = parseArray(req.body.countries);

      let targetType = null;
      let locationValues = [];

      if (pincodes.length > 0) {
        targetType = "pincode";
        locationValues = pincodes.map((pin) => ({
          country: null,
          state: null,
          city: null,
          tehsil: null,
          pincode: pin,
        }));
      } else if (tehsils.length > 0) {
        targetType = "tehsil";
        locationValues = tehsils.map((t) => ({
          country: null,
          state: null,
          city: null,
          tehsil: t,
          pincode: null,
        }));
      } else if (cities.length > 0) {
        targetType = "city";
        locationValues = cities.map((c) => ({
          country: null,
          state: null,
          city: c,
          tehsil: null,
          pincode: null,
        }));
      } else if (states.length > 0) {
        targetType = "state";
        locationValues = states.map((s) => ({
          country: null,
          state: s,
          city: null,
          tehsil: null,
          pincode: null,
        }));
      } else if (countries.length > 0) {
        targetType = "country";
        locationValues = countries.map((c) => ({
          country: c,
          state: null,
          city: null,
          tehsil: null,
          pincode: null,
        }));
      }

      if (!targetType || locationValues.length === 0) {
        safeUnlink(req.file.path);
        return res.status(400).json({
          success: false,
          error: "Please select at least one valid target location.",
        });
      }

      const bannerUrl = `/uploads/campaign/${req.file.filename}`;

      // 7. Database Execution
      client = await pool.connect();
      await client.query("BEGIN");

      // Insert Parent Campaign
      const adInsertResult = await client.query(
        `
        INSERT INTO advertisements (
          advertiser_id,
          title,
          banner_url,
          target_link,
          position,
          start_date,
          end_date,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING id
        `,
        [
          advertiserId,
          title?.trim() || null,
          bannerUrl,
          targetLink.trim(),
          position,
          startDate,
          endDate,
        ]
      );

      const adId = adInsertResult.rows[0].id;

      // Single-Query Bulk Insert for Locations
    const queryParams = [];

const valueClauses = locationValues.map((loc, idx) => {
  const offset = idx * 7;

  queryParams.push(
    adId,             // $1
    targetType,       // $2
    loc.country,      // $3
    loc.state,        // $4
    loc.city,         // $5
    loc.pincode,      // $6
    loc.tehsil        // $7
  );

  return `(
    $${offset + 1},
    $${offset + 2},
    $${offset + 3},
    $${offset + 4},
    $${offset + 5},
    $${offset + 6},
    $${offset + 7}
  )`;
});

const bulkInsertQuery = `
  INSERT INTO advertisement_locations (
    advertisement_id,
    target_type,
    country,
    state,
    city,
    pincode,
    tehsil
  )
  VALUES ${valueClauses.join(", ")}
`;

      await client.query(bulkInsertQuery, queryParams);

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Campaign created successfully.",
        data: {
          advertisementId: adId,
          bannerUrl,
          targetType,
          totalLocationsTargeted: locationValues.length,
        },
      });
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Rollback failed:", rollbackErr);
        }
      }

      // Cleanup uploaded image on error
      if (req.file) safeUnlink(req.file.path);

      console.error("Error creating campaign:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error while creating campaign.",
      });
    } finally {
      if (client) client.release();
    }
  }
);

router.get("/campaigns", authorization, async (req, res) => {
  let client;

  try {
    // 1. Get Authenticated User ID
    const advertiserId =
      req.user?.id || req.user?.userId || req.user?.user_id;

    if (!advertiserId) {
      return res.status(401).json({
        success: false,
        error: "User authentication failed.",
      });
    }

    client = await pool.connect();

    // 2. Fetch Ads with Aggregated Targeted Locations
    const query = `
      SELECT 
        a.id,
        a.title,
        a.banner_url,
        a.target_link,
        a.position,
        a.start_date,
        a.end_date,
        a.status,
        a.created_at,
        -- Aggregate non-null locations into arrays
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.pincode), NULL) AS pincodes,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.tehsil), NULL) AS tehsils,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.city), NULL) AS cities,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.state), NULL) AS states,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.country), NULL) AS countries
      FROM advertisements a
      LEFT JOIN advertisement_locations l ON a.id = l.advertisement_id
      WHERE a.advertiser_id = $1
      GROUP BY a.id
      ORDER BY a.created_at DESC;
    `;

    // FIX HERE: Pass [advertiserId] in an array
    const { rows } = await client.query(query, [advertiserId]);

    // 3. Format Response Data
    const campaigns = rows.map((campaign) => {
      // Determine effective target scale automatically
      let targetType = "country";
      if (campaign.pincodes.length > 0) targetType = "pincode";
      else if (campaign.tehsils.length > 0) targetType = "tehsil";
      else if (campaign.cities.length > 0) targetType = "city";
      else if (campaign.states.length > 0) targetType = "state";

      return {
        id: campaign.id,
        title: campaign.title,
        bannerUrl: campaign.banner_url,
        targetLink: campaign.target_link,
        position: campaign.position,
        startDate: campaign.start_date,
        endDate: campaign.end_date,
        status: campaign.status,
        createdAt: campaign.created_at,
        targetType,
        locations: {
          pincodes: campaign.pincodes,
          tehsils: campaign.tehsils,
          cities: campaign.cities,
          states: campaign.states,
          countries: campaign.countries,
        },
      };
    });

    return res.status(200).json({
      success: true,
      count: campaigns.length,
      data: campaigns,
    });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return res.status(500).json({
      success: false,
      error: "Unable to retrieve campaigns.",
    });
  } finally {
    if (client) client.release();
  }
});
module.exports = router;