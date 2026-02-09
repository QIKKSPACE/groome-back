const pool = require("../config/db");

module.exports = {
  // -------------------------------------
  // GET ALL SERVICES WITH IMAGES AND VENDOR
  // -------------------------------------
  getAllServicesWithImages: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          s.id,
          s.vendor_id,
          s.category_id,
          s.name,
          s.description,
          s.price,
          s.discount_price,
          s.duration_minutes,
          s.status,
          s.created_at,
          s.updated_at,
          -- Aggregate images
          json_agg(
            json_build_object(
              'id', si.id,
              'image_url', si.image_url,
              'sort_order', si.sort_order,
              'created_at', si.created_at
            ) ORDER BY si.sort_order
          ) AS images,
          -- Vendor details
          json_build_object(
            'id', v.id,
            'address', v.address,
            'pincode', v.pincode,
            'city', v.city,
            'state', v.state,
            'verified', v.verified,
            'created_at', v.created_at,
            'updated_at', v.updated_at,
            'user_id', v.user_id,
            'business_name', v.business_name,
            'gst_number', v.gst_number,
            'company_doc', v.company_doc,
            'gst_doc', v.gst_doc,
            'map_address', v.map_address,
            'place_id', v.place_id,
            'latitude', v.latitude,
            'longitude', v.longitude,
            'company_id', v.company_id,
            'geo_location', v.geo_location,
            'delivery_radius_km', v.delivery_radius_km
          ) AS vendor
        FROM services_main s
        LEFT JOIN service_images si
          ON s.id = si.service_id
        LEFT JOIN vendors v
          ON s.vendor_id = v.id
        GROUP BY s.id, v.id
        ORDER BY s.created_at DESC
      `);

      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching services with images and vendor:", error);
      return res.status(500).json({ message: "Server error" });
    }
  },
 
  getServiceById: async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(`
        SELECT 
          -- SERVICE
          json_build_object(
            'id', s.id,
            'vendor_id', s.vendor_id,
            'category_id', s.category_id,
            'name', s.name,
            'description', s.description,
            'price', s.price,
            'discount_price', s.discount_price,
            'duration_minutes', s.duration_minutes,
            'status', s.status,
            'created_at', s.created_at,
            'updated_at', s.updated_at,

            -- IMAGES
            'images', (
              SELECT json_agg(
                json_build_object(
                  'id', si.id,
                  'image_url', si.image_url,
                  'sort_order', si.sort_order,
                  'created_at', si.created_at
                ) ORDER BY si.sort_order
              )
              FROM service_images si
              WHERE si.service_id = s.id
            ),

            -- VENDOR
            'vendor', json_build_object(
              'id', v.id,
              'address', v.address,
              'pincode', v.pincode,
              'city', v.city,
              'state', v.state,
              'verified', v.verified,
              'business_name', v.business_name,
              'map_address', v.map_address,
              'latitude', v.latitude,
              'longitude', v.longitude,
              'delivery_radius_km', v.delivery_radius_km
            ),

            -- SETTINGS
            'settings', (
              SELECT json_build_object(
                'timezone', vs.timezone,
                'open_time', vs.open_time,
                'close_time', vs.close_time,
                'weekly_off_days', vs.weekly_off_days,
                'auto_generate_slots', vs.auto_generate_slots,
                'employee_count', vs.employee_count
              )
              FROM vendor_settings vs 
              WHERE vs.vendor_id = s.vendor_id
            ),

            -- CLOSED DAYS
            'closed_days', (
              SELECT json_agg(
                json_build_object(
                  'day_date', cd.day_date,
                  'reason', cd.reason
                ) ORDER BY cd.day_date
              )
              FROM closed_days cd
              WHERE cd.vendor_id = s.vendor_id
            ),

            -- OTHER SERVICES
            'other_services', (
              SELECT json_agg(
                json_build_object(
                  'id', ss.id,
                  'name', ss.name,
                  'price', ss.price,
                  'discount_price', ss.discount_price,
                  'duration_minutes', ss.duration_minutes
                ) ORDER BY ss.created_at DESC
              )
              FROM services_main ss
              WHERE ss.vendor_id = s.vendor_id 
              AND ss.id != s.id
            )
          ) AS data

        FROM services_main s
        LEFT JOIN vendors v ON v.id = s.vendor_id
        WHERE s.id = $1
        LIMIT 1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Service not found" });
      }

      return res.json(result.rows[0].data);

    } catch (error) {
      console.error("Error fetching service by id:", error);
      res.status(500).json({ message: "Server error" });
    }
  }


};
