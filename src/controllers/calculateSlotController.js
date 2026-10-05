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
  `SELECT
      open_time,
      close_time,
      weekly_off_days,
      employee_count,
      timezone,
      slot_duration
   FROM vendor_settings
   WHERE vendor_id = $1`,
  [vendorId]
);
    if (vendorRes.rowCount === 0) return res.status(404).json({ error: "Vendor settings not found" });

    const vs = vendorRes.rows[0];
   const vendorZone = "Asia/Kolkata";
    const employeeCount = Number(vs.employee_count) || 1;
    const weeklyOff = vs.weekly_off_days || [];

    // 2) Parse requested date
    const dt = DateTime.fromISO(date, { zone: vendorZone });
    if (!dt.isValid) return res.status(400).json({ error: "invalid date" });

    // Luxon: Mon=1 ... Sat=6, Sun=7 -> Convert to JS-style: Sun=0 ... Sat=6
    const weekdayNumber = dt.weekday % 7;

    if (weeklyOff.includes(weekdayNumber)) {
      console.log("Vendor closed due to weekly off");
      return res.json({
        closed: true,
        reason: "weekly_off",
        slots: []
      });
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

    const now = DateTime.now().setZone(vendorZone);
    if (dt.hasSame(now, "day") && now > openDT) {
      openDT = now.plus({ minutes: 1 }).startOf("minute");
    }

    if (openDT >= closeDT) return res.json({ closed: true, reason: "invalid_hours", slots: [] });

    // Fetch Blocked Slots
    const blockedRes = await pool.query(
      `SELECT start_time, "end_time"
       FROM blocked_slots
       WHERE vendor_id = $1
       AND blocked_date = $2`,
      [vendorId, date]
    );

    console.log("Blocked slots fetched:", blockedRes.rows);

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
      return {
        start,
        end,
        emp: Number(b.employee_slot) || 1
      };
    });

    // Parse blocked slots
    const blockedSlots = blockedRes.rows.map(b => {
  const [startH, startM] = b.start_time.split(":").map(Number);
  const [endH, endM] = b.end_time.split(":").map(Number);

  return {
    start: dt.set({
      hour: startH,
      minute: startM,
      second: 0,
      millisecond: 0
    }),
    end: dt.set({
      hour: endH,
      minute: endM,
      second: 0,
      millisecond: 0
    })
  };
});

 

    // 7) Generate slots
   const STEP = Number(vs.slot_duration) || 30;
    const slots = [];
    let cursor = openDT;

    while (cursor.plus({ minutes: duration }) <= closeDT) {
      const slotStart = cursor;
      const slotEnd = cursor.plus({ minutes: duration });

      // Check if slot overlaps with ANY blocked slot time frame
      //const isBlocked = blockedSlots.some(b => b.start < slotEnd && b.end > slotStart);
const isBlocked = blockedSlots.some(b => slotStart >= b.start && slotStart < b.end);
      let employeesUsed = 0;
      let isAvailable = true;

      if (isBlocked) {
        console.log(`Slot ${slotStart.toFormat("HH:mm")} is within a blocked time window.`);
        employeesUsed = employeeCount; // Max out capacity so no one can book
        isAvailable = false;
      } else {
        // Find overlapping bookings if not blocked
        const overlapping = bookings.filter(b => b.start < slotEnd && b.end > slotStart);
        
        employeesUsed = overlapping.reduce((sum, b) => sum + b.emp, 0);
        employeesUsed = Math.min(employeesUsed, employeeCount); // cap at max employee count
        isAvailable = employeesUsed < employeeCount;
      }

      console.log("Slot:", slotStart.toFormat("HH:mm"), "Employees used:", employeesUsed, "Available:", isAvailable);

      slots.push({
        time: slotStart.toFormat("HH:mm"),
        employees_used: employeesUsed,
        available: isAvailable,
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