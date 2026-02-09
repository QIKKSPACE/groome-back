// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/vendorController");
const superadminAuth = require("../middlewares/vendorAuth");
const upload = require("../middlewares/upload"); // your multer file uploader
// GET /auth/check-username?username=...

//post /auth/login
router.post("/login", ctrl.login);
router.get("/webflow",superadminAuth, ctrl.webflow);
router.get("/services",superadminAuth, ctrl.getServices);

router.post("/settings",superadminAuth, ctrl.saveVendorSettings);
router.delete("/services/:serviceId",superadminAuth, ctrl.deleteService);

router.post("/services",superadminAuth,
    upload.array("images", 10), // upload up to 10 files
    ctrl.createServices);





module.exports = router;
