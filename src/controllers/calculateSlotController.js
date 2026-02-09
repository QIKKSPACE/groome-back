const pool = require("../config/db");
const { DateTime } = require("luxon");

// GET /calculateSlot/:serviceId?date=YYYY-MM-DD&vendorId=xxx&duration=30
async function calculateSlots(req, res) {
  try {
    const { serviceId } = req.params;
    const { vendorId, date, duration: durationStr } = req.query;
    const duration = Number(durationStr);

    if (!vendorId) return res.status(400).json({ error: "vendorId required" });
    if (!date) return res.status(400).json({ error: "date required" });
    if (!duration || duration <= 0) return res.status(400).json({ error: "duration required" });

    // 1) Fetch vendor settings
    const vendorRes = await pool.query(
      `SELECT open_time, close_time, weekly_off_days, employee_count, timezone
       FROM vendor_settings WHERE vendor_id = $1`,
      [vendorId]
    );
    if (vendorRes.rowCount === 0) return res.status(404).json({ error: "Vendor settings not found" });

    const vs = vendorRes.rows[0];
    const vendorZone = vs.timezone || "Asia/Kolkata";
    const employeeCount = Number(vs.employee_count) || 1;
    const weeklyOff = vs.weekly_off_days || [];

    console.log("Vendor settings:", vs);

    // 2) Parse requested date
    const dt = DateTime.fromISO(date, { zone: vendorZone });
    if (!dt.isValid) return res.status(400).json({ error: "invalid date" });

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    if (weeklyOff.includes(days[dt.weekday % 7])) {
      console.log("Vendor closed due to weekly off");
      return res.json({ closed: true, reason: "weekly_off", slots: [] });
    }

    // 3) Check closed_days table
    const closedRes = await pool.query(
      `SELECT 1 FROM closed_days WHERE vendor_id=$1 AND day_date=$2`,
      [vendorId, date]
    );
    if (closedRes.rowCount > 0) {
      console.log("Vendor closed due to closed_days");
      return res.json({ closed: true, reason: "closed_day", slots: [] });
    }

    // 4) Build open & close timestamps
    const [openH, openM] = vs.open_time.split(":").map(Number);
    const [closeH, closeM] = vs.close_time.split(":").map(Number);

    let openDT = dt.set({ hour: openH, minute: openM, second: 0, millisecond: 0 });
    const closeDT = dt.set({ hour: closeH, minute: closeM, second: 0, millisecond: 0 });

    console.log("Open time:", openDT.toISO());
    console.log("Close time:", closeDT.toISO());

    const now = DateTime.now().setZone(vendorZone);
    if (dt.hasSame(now, "day") && now > openDT) {
      openDT = now.plus({ minutes: 1 }).startOf("minute");
    }

    if (openDT >= closeDT) return res.json({ closed: true, reason: "invalid_hours", slots: [] });

    // 5) Fetch bookings
    const bookingRes = await pool.query(
      `SELECT start_ts, end_ts, employee_slot FROM confirmed_bookings
       WHERE vendor_id=$1 AND slot_date=$2 AND status IN ('confirmed','pending')`,
      [vendorId, date]
    );

    console.log("Bookings fetched:", bookingRes.rows.length);

    // 6) Parse bookings
    const bookings = bookingRes.rows.map(b => {
      const start = DateTime.fromJSDate(b.start_ts).setZone(vendorZone, { keepLocalTime: false });
      const end = DateTime.fromJSDate(b.end_ts).setZone(vendorZone, { keepLocalTime: false });
      console.log("Parsed booking:", start.toISO(), "->", end.toISO(), "Employees:", b.employee_slot);
      return {
        start,
        end,
        emp: Number(b.employee_slot) || 1
      };
    });

    // 7) Generate slots
    const STEP = 30; // minutes between slots
    const slots = [];
    let cursor = openDT;

    while (cursor.plus({ minutes: duration }) <= closeDT) {
      const slotStart = cursor;
      const slotEnd = cursor.plus({ minutes: duration });

      // Find overlapping bookings
      const overlapping = bookings.filter(b => b.start < slotEnd && b.end > slotStart);
      overlapping.forEach(b => console.log("Overlap detected:", b.start.toISO(), "-", b.end.toISO(), "with slot", slotStart.toISO(), "-", slotEnd.toISO()));

      // Sum employees used
      let employeesUsed = overlapping.reduce((sum, b) => sum + b.emp, 0);
      employeesUsed = Math.min(employeesUsed, employeeCount); // cap at employee count

      console.log("Slot:", slotStart.toFormat("HH:mm"), "Employees used:", employeesUsed);

      slots.push({
        time: slotStart.toFormat("HH:mm"),
        employees_used: employeesUsed,
        available: employeesUsed < employeeCount,
        capacity: employeeCount
      });

      cursor = cursor.plus({ minutes: STEP });
    }

    return res.json({ closed: false, date, slots });
  } catch (err) {
    console.error("calculateSlots error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
}

module.exports = { calculateSlots };
