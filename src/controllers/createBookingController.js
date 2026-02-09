const { v4: uuidv4 } = require("uuid");
const pool = require("../config/db");

// POST /bookings
async function createBooking(req, res) {
  try {
    const userId = req.user.userId; // Logged-in user
    console.log("Booking request by user:", userId);

    const {
      vendor_id,
      service_id, // Array of UUIDs
      employee_slot,
      start_ts,
      end_ts,
      slot_date,
      metadata = {}
    } = req.body;

    console.log("Request body:", req.body);

    // --- Validation ---
    if (!vendor_id) return res.status(400).json({ error: "vendor_id is required" });
    if (!service_id || !Array.isArray(service_id) || service_id.length === 0)
      return res.status(400).json({ error: "service_id must be a non-empty array" });
    if (!employee_slot) return res.status(400).json({ error: "employee_slot is required" });
    if (!start_ts) return res.status(400).json({ error: "start_ts is required" });
    if (!end_ts) return res.status(400).json({ error: "end_ts is required" });
    if (!slot_date) return res.status(400).json({ error: "slot_date is required" });

    const id = uuidv4();
    const status = "booked";

    // --- Convert service_id array to Postgres UUID[] literal ---
    const serviceArrayLiteral = `{${service_id.join(",")}}`;

    const insertQuery = `
      INSERT INTO confirmed_bookings (
        id, vendor_id, service_id, user_id,
        employee_slot, start_ts, end_ts, slot_date,
        status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;

    const values = [
      id,
      vendor_id,
      serviceArrayLiteral, // <-- UUID[] literal for Postgres
      userId,
      employee_slot,
      start_ts, // ISO strings are fine for TIMESTAMP columns
      end_ts,
      slot_date,
      'confirmed',
      metadata
    ];

    const result = await pool.query(insertQuery, values);

    return res.json({
      status: "success",
      booking: result.rows[0]
    });

  } catch (err) {
    console.error("Create Booking Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { createBooking };
