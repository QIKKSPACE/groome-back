// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/verificationController");
const authorization = require("../middlewares/auth");
const upload = require("../middlewares/upload"); // ✅ file upload middleware

// CREATE Vendors....

router.post(
  "/vendors",
  authorization,
  upload.fields([
    { name: "company_doc", maxCount: 1 },
    { name: "gst_doc", maxCount: 1 },
  ]),
  ctrl.createVendor
);

router.post(
  "/malls",
  authorization,
  upload.fields([
    { name: "company_doc", maxCount: 1 },
  ]),
  ctrl.createMall
);
router.post(
  "/influencer",
  authorization,
  upload.fields([
    { name: "profile_picture", maxCount: 1 },
  ]),
  ctrl.createInfluencer
);

router.post(
  "/manufacturers",   
  authorization,
  upload.fields([
    { name: "company_doc", maxCount: 1 },
  ]),
  ctrl.createManufacturer
);
router.post(
  "/delivery",   
  authorization,
  upload.fields([
    { name: "dl_image", maxCount: 1 },
  ]),
  ctrl.createDeliveryPartner
);

router.post(
  "/franchises",   
  authorization,
  upload.fields([
    { name: "dl_image", maxCount: 1 },
  ]),
  ctrl.createFranchise
);
module.exports = router;
