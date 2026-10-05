const express = require("express");
const axios = require("axios");

const {
  loginSuperadmin,

  // categories
  getCategories,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,

  // services
  getServices,
  createService,
  updateService,
  toggleServiceStatus,
  deleteService,

  // banners
  getBanners,
  createBanner,
  updateBanner,
  toggleBannerStatus,
  deleteBanner,

  //Vendors
    getVendors,
  createVendor,
  updateVendor,
  verifyVendor,
  deleteVendor,
  lookupZip,
    addCity,
  deleteCity,
  getCities,
    addFranchiseType,
  deleteFranchiseType,
  getFranchiseTypes,
    getPromotions,
  addPromotion,
  updatePromotion,
  deletePromotion,
  getDeliveryPartners,
  getFranchises,
  lookupLatLng,
  getUnverifiedInfluencers,
  verifyinfluencer,
  getVerifiedInfluencers,
  updateShowOnFrontend,

getManufacturers,
getManufacturerById,
verifyManufacturer,
getManufacturerProducts,
updateProductTerms,
getMallById,
  getMalls,
  verifyMall,
  updateCredit,

} = require("../controllers/superAdminController");

const superadminAuth = require("../middlewares/superadminAuth");
const upload = require("../middlewares/upload"); // ✅ file upload middleware

const router = express.Router();
const {
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  getAllCreators,
  getCreatorById,
  createCreator,
  updateCreator,
  deleteCreator,
  getVendor,
  approveVendor


} = require("../controllers/superAdminControllerOther");
const pool = require("../config/db");




// ---------- Superadmin Login ----------
router.post("/login", loginSuperadmin);

// ---------- Categories ----------
router.get("/categories", superadminAuth, getCategories);
router.post("/categories",upload.single("image"), superadminAuth, createCategory);
router.put("/categories/:id",upload.single("image"), superadminAuth, updateCategory);
router.patch("/categories/:id/status", superadminAuth, toggleCategoryStatus);
router.delete("/categories/:id", superadminAuth, deleteCategory);

// ---------- Services ----------
router.get("/services", superadminAuth, getServices);
router.post("/services",upload.single("image"), superadminAuth, createService);
router.put("/services/:id",upload.single("image"), superadminAuth, updateService);
router.patch("/services/:id/status", superadminAuth, toggleServiceStatus);
router.delete("/services/:id", superadminAuth, deleteService);

// ---------- Banners ----------
router.get("/banners", superadminAuth, getBanners);
router.post("/banners", superadminAuth, upload.single("file"), createBanner); // ✅ with file upload
router.put("/banners/:id", superadminAuth, upload.single("file"), updateBanner); // ✅ with file upload
router.patch("/banners/:id/status", superadminAuth, toggleBannerStatus);
router.delete("/banners/:id", superadminAuth, deleteBanner);
router.patch(
  "/vendors/:id/approve",
  superadminAuth,
  approveVendor
);
router.get("/vendors/:id", getVendor);
// ---------- Vendors ----------
router.get("/vendors", getVendors);
router.post(
  "/vendors",
  upload.fields([
    { name: "company_doc", maxCount: 1 },
    { name: "gst_doc", maxCount: 1 },
  ]),
  createVendor
);
router.put("/vendors/:id", updateVendor);
router.patch("/vendors/:id/verify", verifyVendor);
router.delete("/vendors/:id", deleteVendor);


router.post("/city", addCity);
router.get("/city", getCities);
router.delete("city/:id", deleteCity);

router.post("/franchise", addFranchiseType);
router.get("/franchise", getFranchiseTypes);
router.delete("/franchise/:id", deleteFranchiseType);

router.get("/promotion", getPromotions);
router.post("/promotion", addPromotion);
router.put("/promotion/:id", updatePromotion);
router.delete("/promotion/:id", deletePromotion);
router.get("/delivery-partners", getDeliveryPartners);
router.get("/franchisesmain", getFranchises);



router.get("/zip-lookup", lookupZip); 
router.get("/longlat", lookupLatLng);

//----------------PACKAGES-------------//

router.get("/packages", getAllPackages);
router.get("/packages/:id", getPackageById);
router.post("/packages", createPackage);
router.put("/packages/:id", updatePackage);
router.delete("/packages/:id", deletePackage);
router.get("/creators", getAllCreators);
router.get("/creators/:id", getCreatorById);
router.post("/creators", upload.single("video"), createCreator);
router.post("/influencers/:id/videos", upload.single("video"), updateCreator);
router.delete("/creators/:id", deleteCreator);
router.get("/influencers/getUnverifiedInfluencers", getUnverifiedInfluencers);
router.post("/verifyInfluencer/:id", verifyinfluencer);
router.get("/influencers/getVerifiedInfluencers", getVerifiedInfluencers);

router.post("/showonfrontend", updateShowOnFrontend);
router.get("/manufacturers", getManufacturers);
router.get("/manufacturers/:id", getManufacturerById);
router.patch('/manufacturers/:id',verifyManufacturer)
router.get('/manufacturer/:userId',getManufacturerProducts)
router.patch('/products/:productId', updateProductTerms);
router.get("/malls", getMalls);
router.get("/malls/:id", getMallById);
router.patch('/malls/:id',verifyMall)
router.patch(
  "/malls/:mallId/credits",
 
  updateCredit
);




router.get("/influencers/:id/videos", async (req, res) => {
  try {
    const { id } = req.params; // influencer ID

    const result = await pool.query(
      `
      SELECT id AS video_id,
             video_url,
             title,
             description,
             created_at
      FROM influencer_videos
      WHERE influencer_id = $1
      ORDER BY created_at DESC
      `,
      [id]
    );

    // Always return an array (empty if no videos)
    return res.json(result.rows);
  } catch (error) {
    console.error("Error fetching videos:", error);
    return res.status(500).json({ message: "Server error" });
  }
});
router.get("/pincode", async (req, res) => {
  try {
    const { lat, lng } = req.query;

    // Validate latitude and longitude
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required.",
      });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude or longitude.",
      });
    }

    const response = await axios.get(
      "https://nominatim.openstreetmap.org/reverse",
      {
        params: {
          lat: latitude,
          lon: longitude,
          format: "jsonv2",
          addressdetails: 1,
        },
        headers: {
          "User-Agent": "thegroome/1.0",
        },
        timeout: 10000,
      }
    );

    const address = response.data?.address;

    const pincode = address?.postcode;

    if (!pincode) {
      return res.status(404).json({
        success: false,
        message: "Pincode could not be found for this location.",
      });
    }
   console.log("Reverse geocoding successful:", {
      lat: latitude,
      lng: longitude,
      pincode,
      address,
    });
    return res.json({
      success: true,
      pincode,
      lat: latitude,
      lng: longitude,
      address,
    });
  } catch (error) {
    console.error(
      "Reverse geocoding error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get pincode from coordinates.",
    });
  }
});
router.get("/campaigns", async (req, res) => {
  let client;

  try {
    client = await pool.connect();

    // Fetch All Ads with Aggregated Targeted Locations and Advertiser Details
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
        u.id AS advertiser_id,
        u.name AS advertiser_name,
        u.phone AS advertiser_phone,
        u.email AS advertiser_email,
        -- Aggregate non-null locations into arrays
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.pincode), NULL) AS pincodes,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.tehsil), NULL) AS tehsils,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.city), NULL) AS cities,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.state), NULL) AS states,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.country), NULL) AS countries
      FROM advertisements a
      LEFT JOIN users u ON u.id = a.advertiser_id -- Replace 'a.user_id' with 'a.advertiser_id' if your foreign key is named differently
      LEFT JOIN advertisement_locations l ON a.id = l.advertisement_id
      GROUP BY a.id, u.id, u.name, u.phone, u.email
      ORDER BY a.created_at DESC;
    `;

    const { rows } = await client.query(query);

    // Format Response Data
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
        advertiser: {
          id: campaign.advertiser_id,
          name: campaign.advertiser_name,
          email: campaign.advertiser_email,
          phone: campaign.advertiser_phone,
        },
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
    console.error("Error fetching all campaigns:", error);
    return res.status(500).json({
      success: false,
      error: "Unable to retrieve campaigns.",
    });
  } finally {
    if (client) client.release();
  }
});

// Express.js Route: Approve or Reject a Campaign
router.post("/campaigns/status", async (req, res) => {
  const { id, status } = req.body;

  // 1. Validation
  if (!id || !status) {
    return res.status(400).json({
      success: false,
      message: "Both advertisement 'id' and 'status' are required.",
    });
  }

  // Normalize status to uppercase
  const normalizedStatus = status.trim().toUpperCase();
  const validStatuses = ["APPROVED", "REJECTED", "PENDING"];

  if (!validStatuses.includes(normalizedStatus)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status provided. Allowed values are: ${validStatuses.join(", ")}`,
    });
  }

  let client;

  try {
    client = await pool.connect();

    // 2. Execute Update Query
    const updateQuery = `
      UPDATE advertisements
      SET status = $1
       
      WHERE id = $2
      RETURNING id, title, status;
    `;

    const { rows, rowCount } = await client.query(updateQuery, [
      normalizedStatus,
      id,
    ]);

    // 3. Handle Not Found
    if (rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Campaign with ID ${id} not found.`,
      });
    }

    // 4. Return Success Response
    return res.status(200).json({
      success: true,
      message: `Campaign status updated to '${normalizedStatus}' successfully.`,
      data: rows[0],
    });
  } catch (error) {
    console.error("Error updating campaign status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating campaign status.",
    });
  } finally {
    if (client) client.release();
  }
});
//verifyInfluencer/:id
router.post("/kyc/accept/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      `
      UPDATE kyc
      SET
        status = 'VERIFIED',
        rejection_reason = NULL,
        verified_at = NOW(),
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING *;
      `,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "KYC not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "KYC accepted successfully",
      kyc: result.rows[0],
    });
  } catch (error) {
    console.error("Accept KYC error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to accept KYC",
    });
  }
});


// REJECT KYC
router.post("/kyc/reject/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const result = await pool.query(
      `
      UPDATE kyc
      SET
        status = 'REJECTED',
        rejection_reason = $2,
        verified_at = NULL,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING *;
      `,
      [user_id, rejection_reason]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "KYC not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "KYC rejected successfully",
      kyc: result.rows[0],
    });
  } catch (error) {
    console.error("Reject KYC error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reject KYC",
    });
  }
});

module.exports = router;
