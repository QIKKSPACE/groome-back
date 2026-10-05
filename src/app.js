// src/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();
const path = require("path");
const authRoutes = require("./routes/authRoutes");
const superadminRoutes = require("./routes/superadminroute");
const webflowRoutes = require("./routes/webflow");
const  googlePlacesRouter =require( "./routes/googlePlaces.js");
const  verificationRouter =require( "./routes/verificationRoutes");
const  vendorRouter =require( "./routes/vendorRoutes");
const  manufacturerRouter =require( "./routes/manufacturerRoutes");

const  userRouter =require( "./routes/userRoutes");
const influencerRoute=require('./routes/influencerRoute.js')
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const affiliateRoutes = require("./routes/afflliateRoute.js");

const locationRoutes = require("./routes/locationRoute.js");
const advertismentRoutes = require("./routes/advertismentRoute.js");

const campaignRoutes = require("./routes/campaigns.js");
const mallRoutes = require("./routes/mallRoute.js");
const kycRoutes = require("./routes/kycRoutes.js");





const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use("/auth", authRoutes);
app.use("/verification", verificationRouter);


app.use("/places", googlePlacesRouter);
app.use("/webflow", webflowRoutes);
app.use("/superadmin", superadminRoutes);
app.use("/vendors", vendorRouter);
app.use("/manufacturers", manufacturerRouter);
app.use("/users", userRouter);
app.use("/influencer", influencerRoute);
app.use("/categories", categoryRoutes);
app.use("/products", productRoutes);
app.use("/affiliate", affiliateRoutes);
app.use("/location", locationRoutes);
app.use("/adv-pricing", advertismentRoutes);
app.use("/campaigns", campaignRoutes);
app.use("/mall", mallRoutes);
app.use("/kyc", kycRoutes);








app.use("/uploads", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(__dirname, "uploads")));

// basic health check
app.get("/", (req, res) => res.send("Aurameter backend is up"));

module.exports = app;
