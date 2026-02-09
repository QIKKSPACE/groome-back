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
const  userRouter =require( "./routes/userRoutes");
const influencerRoute=require('./routes/influencerRoute.js')



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
app.use("/users", userRouter);
app.use("/influencer", influencerRoute);



app.get("/uploads/:filename", (req, res) => {
  res.sendFile(path.join(__dirname, "/uploads", req.params.filename), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
    }
  });
});
// basic health check
app.get("/", (req, res) => res.send("Aurameter backend is up"));

module.exports = app;
