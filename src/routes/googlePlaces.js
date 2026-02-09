// routes/googlePlaces.js
const express = require("express");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const router = express.Router();
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Enable CORS for all routes in this router
router.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// -------------------------
// Autocomplete route
// -------------------------
router.get("/autocomplete", async (req, res) => {
  const query = req.query.query?.trim() || "";

  if (!query) {
    return res.json([]);
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      query
    )}&key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.predictions) return res.json([]);

    const places = data.predictions.map((item) => ({
      description: item.description,
      place_id: item.place_id,
    }));

    return res.json(places);
  } catch (error) {
    console.error("Google Autocomplete API error:", error);
    return res.status(500).json({ error: "Failed to fetch autocomplete results" });
  }
});

// -------------------------
// Place details route
// -------------------------
router.get("/details", async (req, res) => {
  const place_id = req.query.place_id?.trim();

  if (!place_id) {
    return res.json([]);
  }

  try {
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      place_id
    )}&key=${GOOGLE_API_KEY}`;

    const response = await fetch(detailsUrl);
    const data = await response.json();

    if (data.result?.geometry?.location) {
      const location = data.result.geometry.location;
      const address = data.result.formatted_address;
      return res.json({
        description: address,
        lat: location.lat,
        lng: location.lng,
      });
    } else {
      return res.json([]);
    }
  } catch (error) {
    console.error("Google Place Details API error:", error);
    return res.status(500).json({ error: "Failed to fetch place details" });
  }
});

module.exports = router;
