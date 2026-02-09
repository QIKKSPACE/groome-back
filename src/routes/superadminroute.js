const express = require("express");
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
  getMalls,
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
  updateShowOnFrontend
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
router.get("/malls", getMalls);

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




//verifyInfluencer/:id

module.exports = router;
