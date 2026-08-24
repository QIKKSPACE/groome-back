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
            'delivery_radius_km', v.delivery_radius_km,
            'profile_image', v.profile_image
          ) AS vendor
      FROM services_main s
LEFT JOIN service_images si
  ON s.id = si.service_id

JOIN vendors v
  ON s.vendor_id = v.id
  AND v.verified = true

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
   'profile_image', v.profile_image,
  'map_address', v.map_address,
  'latitude', v.latitude,
  'longitude', v.longitude,
  'delivery_radius_km', v.delivery_radius_km,
  'why_choose_us', v.why_choose_us,
  'delay_time_minutes', v.delay_time_minutes,
  'is_delay_active', v.is_delay_active
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
        AND v.verified = true
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
  },

 
  getServicesByCategory: async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 
        json_agg(
          json_build_object(
            -- SERVICE
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
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'id', si.id,
                    'image_url', si.image_url,
                    'sort_order', si.sort_order,
                    'created_at', si.created_at
                  )
                  ORDER BY si.sort_order
                ),
                '[]'::json
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
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'day_date', cd.day_date,
                    'reason', cd.reason
                  )
                  ORDER BY cd.day_date
                ),
                '[]'::json
              )
              FROM closed_days cd
              WHERE cd.vendor_id = s.vendor_id
            ),

            -- OTHER SERVICES
            'other_services', (
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'id', ss.id,
                    'name', ss.name,
                    'price', ss.price,
                    'discount_price', ss.discount_price,
                    'duration_minutes', ss.duration_minutes
                  )
                  ORDER BY ss.created_at DESC
                ),
                '[]'::json
              )
              FROM services_main ss
              WHERE ss.vendor_id = s.vendor_id 
              AND ss.id != s.id
            )
          )
        ) AS services
      FROM services_main s
      LEFT JOIN vendors v ON v.id = s.vendor_id
      WHERE s.category_id = $1
      `,
      [id]
    );

    const services = result.rows[0]?.services || [];

    return res.json({
      category_id: id,
      services
    });
  } catch (error) {
    console.error("Error fetching services by category:", error);
    return res.status(500).json({ message: "Server error" });
  }
  },
getAllServicesWithImagesByCategory: async (req, res) => {
  try {
    const { category } = req.params;

    console.log("=================================");
    console.log("Category received:", category);
    const categoryName = decodeURIComponent(category)
  .replace(/-/g, " ");

    // Check whether the category exists
    const categoryResult = await pool.query(
      `
      SELECT id, name
      FROM services
      WHERE LOWER(name) = LOWER($1)
      `,
      [categoryName]
    );

    console.log("Matching category:", categoryResult.rows);

    if (categoryResult.rows.length === 0) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    const categoryId = categoryResult.rows[0].id;

    console.log("Category ID:", categoryId);

    // Check services_main entries for this category
    const countResult = await pool.query(
      `
      SELECT id, name, category_id
      FROM services_main
      WHERE category_id = $1
      `,
      [categoryId]
    );

    console.log("Services found:", countResult.rows.length);
    console.log(countResult.rows);

    const result = await pool.query(
      `
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

          COALESCE(
              json_agg(
                  json_build_object(
                      'id', si.id,
                      'image_url', si.image_url,
                      'sort_order', si.sort_order,
                      'created_at', si.created_at
                  )
                  ORDER BY si.sort_order
              ) FILTER (WHERE si.id IS NOT NULL),
              '[]'
          ) AS images,

          json_build_object(
              'id', v.id,
              'business_name', v.business_name,
              'profile_image', v.profile_image,
              'city', v.city,
              'state', v.state,
              'verified', v.verified
          ) AS vendor

      FROM services_main s

      LEFT JOIN service_images si
          ON s.id = si.service_id

     JOIN vendors v
    ON s.vendor_id = v.id
    AND v.verified = true

      WHERE s.category_id = $1

      GROUP BY s.id, v.id

      ORDER BY s.created_at DESC
      `,
      [categoryId]
    );

    console.log("Final rows:", result.rows.length);

    return res.json(result.rows);

  } catch (error) {
    console.error("Error fetching services by category:");
    console.error(error);

    return res.status(500).json({
      message: error.message,
    });
  }
},
getProductById: async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
          p.id,
          p.user_id,
          p.mall_id,
          p.category_id,
          p.sub_category_id,
          p.product_code,
          p.name,
          p.description,
          p.price,
          p.selling_price,
          p.stock_quantity,
          p.status,
          p.quality_tier,
          p.created_at,
          p.updated_at,

          -- Images
          COALESCE(
              json_agg(
                  DISTINCT jsonb_build_object(
                      'id', pi.id,
                      'image_url', pi.image_url,
                      'is_primary', pi.is_primary,
                      'sort_order', pi.sort_order
                  )
                  ORDER BY
                  jsonb_build_object(
                      'id', pi.id,
                      'image_url', pi.image_url,
                      'is_primary', pi.is_primary,
                      'sort_order', pi.sort_order
                  )->>'sort_order'
              ) FILTER (WHERE pi.id IS NOT NULL),
              '[]'
          ) AS images,

          -- Vendor
          json_build_object(
              'id', v.id,
              'business_name', v.business_name,
              'profile_image', v.profile_image,
              'address', v.address,
              'city', v.city,
              'state', v.state,
              'pincode', v.pincode,
              'verified', v.verified,
              'latitude', v.latitude,
              'longitude', v.longitude
          ) AS vendor,

          -- Mall
          json_build_object(
              'id', m.id,
              'name', m.name
          ) AS mall,

          -- Category
          json_build_object(
              'id', c.id,
              'name', c.name
          ) AS category,

          -- Sub Category
          json_build_object(
              'id', sc.id,
              'name', sc.name
          ) AS sub_category

      FROM products p

      LEFT JOIN product_images pi
          ON p.id = pi.product_id

      LEFT JOIN users u
          ON p.user_id = u.id

      LEFT JOIN vendors v
          ON u.id = v.user_id

      LEFT JOIN malls m
          ON p.mall_id = m.id

      LEFT JOIN categories c
          ON p.category_id = c.id

      LEFT JOIN categories sc
          ON p.sub_category_id = sc.id

      WHERE p.id = $1

      GROUP BY
          p.id,
          v.id,
          m.id,
          c.id,
          sc.id;
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get Product Error:", err);

    res.status(500).json({
      message: "Failed to fetch product",
    });
  }
},
};

