const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
// --- Superadmin login ---
const loginSuperadmin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM superadmins WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.ACCESS_TOKEN_SUPER,
      { expiresIn: "1d" }
    );

    return res.json({ accessToken: token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- Categories CRUD ---

// GET /categories
const getCategories = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM categories ORDER BY sort_order ASC");
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch categories" });
  }
};

// POST /categories
const createCategory = async (req, res) => {
  const {
    name,
    description,
    parent_id,
    sort_order,
    commission,
    platform_commission = 0,
  } = req.body;

  console.log(req.body);

  const imageUrl = req.file
    ? `/uploads/${req.file.filename}`
    : null;

  if (!name || !sort_order || commission == null) {
    return res.status(400).json({
      message: "Name, sort_order, and commission are required",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO categories
      (
        name,
        description,
        parent_id,
        sort_order,
        commission,
        platform_commission,
        image_url,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING *`,
      [
        name,
        description || null,
        parent_id || null,
        sort_order,
        commission,
        platform_commission || 0,
        imageUrl,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error creating category:", error);
    return res.status(500).json({
      message: "Failed to create category",
    });
  }
};



// PUT /categories/:id
const updateCategory = async (req, res) => {
  const { id } = req.params;

  const {
    name,
    description,
    parent_id,
    sort_order,
    commission,
    platform_commission,
  } = req.body;

  const imageUrl = req.file
    ? `/uploads/${req.file.filename}`
    : null;

  try {
    const result = await pool.query(
      `UPDATE categories
       SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         parent_id = COALESCE($3, parent_id),
         sort_order = COALESCE($4, sort_order),
         commission = COALESCE($5, commission),
         platform_commission = COALESCE($6, platform_commission),
         image_url = COALESCE($7, image_url),
         updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        name ?? null,
        description ?? null,
        parent_id ?? null,
        sort_order ?? null,
        commission ?? null,
        platform_commission ?? null,
        imageUrl,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error updating category:", error);
    return res.status(500).json({
      message: "Failed to update category",
    });
  }
};

// PATCH /categories/:id/status
const toggleCategoryStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const category = await pool.query("SELECT is_active FROM categories WHERE id=$1", [id]);
    if (category.rows.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    const newStatus = !category.rows[0].is_active;
    const result = await pool.query(
      "UPDATE categories SET is_active=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [newStatus, id]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to toggle status" });
  }
};

// DELETE /categories/:id
const deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("DELETE FROM categories WHERE id=$1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete category" });
  }
};


/* SERVICES */
const getServices = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM services ORDER BY id ASC");
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch services" });
  }
};

// POST /services
const createService = async (req, res) => {
  const {
    name,
    description,
    commission,
    affiliate_commission = 0,
  } = req.body;

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  if (!name || commission == null) {
    return res
      .status(400)
      .json({ message: "Name and commission are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO services (
          name,
          description,
          commission,
          affiliate_commission,
          image_url,
          is_active
       )
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [
        name,
        description || null,
        commission,
        affiliate_commission,
        imageUrl,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating service:", error);
    return res.status(500).json({ message: "Failed to create service" });
  }
};


// PUT /services/:id
const updateService = async (req, res) => {
  const { id } = req.params;

  const {
    name,
    description,
    commission,
    affiliate_commission,
  } = req.body;

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    let query;
    let values;

    if (imageUrl) {
      query = `
        UPDATE services
        SET
          name = $1,
          description = $2,
          commission = $3,
          affiliate_commission = $4,
          image_url = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING *;
      `;

      values = [
        name,
        description || null,
        commission,
        affiliate_commission,
        imageUrl,
        id,
      ];
    } else {
      query = `
        UPDATE services
        SET
          name = $1,
          description = $2,
          commission = $3,
          affiliate_commission = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *;
      `;

      values = [
        name,
        description || null,
        commission,
        affiliate_commission,
        id,
      ];
    }

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Service not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating service:", error);
    return res.status(500).json({ message: "Failed to update service" });
  }
};

// PATCH /services/:id/status
const toggleServiceStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const service = await pool.query(
      "SELECT is_active FROM services WHERE id=$1",
      [id]
    );
    if (service.rows.length === 0) {
      return res.status(404).json({ message: "Service not found" });
    }

    const newStatus = !service.rows[0].is_active;
    const result = await pool.query(
      "UPDATE services SET is_active=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [newStatus, id]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to toggle status" });
  }
};

// DELETE /services/:id
const deleteService = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM services WHERE id=$1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Service not found" });
    }

    return res.json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete service" });
  }
};


// ================= Banners CRUD =================

// GET /banners
const getBanners = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM banners ORDER BY created_at DESC"
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch banners" });
  }
};

// POST /banners
// POST /banners
const createBanner = async (req, res) => {
  const {
    title,
    description,
    position,
    linkUrl,
  } = req.body;

  try {
    let image_url = null;
    let file_name = null;
    let file_type = null;

    if (req.file) {
      image_url = `/uploads/${req.file.filename}`;
      file_name = req.file.originalname;
      file_type = req.file.mimetype;
    }

    const result = await pool.query(
      `INSERT INTO banners (
        title,
        description,
        image_url,
        file_name,
        file_type,
        position,
        link_url,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING *`,
      [
        title,
        description,
        image_url,
        file_name,
        file_type,
        position,
        linkUrl || null,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create banner error:", error);

    return res.status(500).json({
      message: "Failed to create banner",
      error: error.message,
    });
  }
};
// PUT /banners/:id
const updateBanner = async (req, res) => {
  const { id } = req.params;

  const {
    title,
    description,
    position,
    is_active,
    linkUrl,
  } = req.body;

  try {
    let image_url = null;
    let file_name = null;
    let file_type = null;

    if (req.file) {
      image_url = `/uploads/${req.file.filename}`;
      file_name = req.file.originalname;
      file_type = req.file.mimetype;
    }

    const result = await pool.query(
      `UPDATE banners
       SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         position = COALESCE($3, position),
         is_active = COALESCE($4, is_active),
         image_url = COALESCE($5, image_url),
         file_name = COALESCE($6, file_name),
         file_type = COALESCE($7, file_type),
         link_url = COALESCE($8, link_url),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        title,
        description,
        position,
        is_active,
        image_url,
        file_name,
        file_type,
        linkUrl,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Banner not found",
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Update banner error:", error);

    return res.status(500).json({
      message: "Failed to update banner",
      error: error.message,
    });
  }
};
// PATCH /banners/:id/status
const toggleBannerStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE banners
       SET is_active = NOT is_active, updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Banner not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to toggle banner status" });
  }
};

// DELETE /banners/:id
const deleteBanner = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM banners WHERE id=$1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Banner not found" });
    }

    return res.json({ message: "Banner deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete banner" });
  }
};


// --- vendors CRUD ---

// =======================
// GET /superadmin/vendors
// =======================
const getVendors = async (req, res) => {
  try {
    const query = `
      SELECT 
        v.id,
        v.business_name,
        u.name AS owner_name,
        u.email,
        u.phone,
        v.address,
        v.pincode AS zip_code,
        v.city,
        v.state,
        'India' AS country,
        v.verified AS is_verified,
        TRUE AS is_active,
        v.created_at AS joined_at,
        0 AS rating,
        0 AS total_sales,
        -- Aggregate services
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', s.id,
              'name', s.name,
              'description', s.description,
              'commission', s.commission,
              'is_active', s.is_active,
              'image_url', s.image_url
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS services
      FROM vendors v
      JOIN users u ON v.user_id = u.id
      LEFT JOIN vendor_services vs ON vs.vendor_id = v.id
      LEFT JOIN services s ON s.id = vs.service_id
      GROUP BY v.id, u.name, u.email, u.phone
      ORDER BY v.created_at DESC;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching vendors:", err);
    res.status(500).json({ error: "Server error" });
  }
};


// ===========================================
// POST /superadmin/vendors (User + Vendor)
// ===========================================
const createVendor = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      owner_name,
      email,
      phone,
      service_id,
      address,
      zip_code,
      city,
      state,
      business_name,
      gst_number,
    } = req.body;  

    // Multer will give file objects if present
    const companyDoc = req.files?.company_doc?.[0] || null;
    const gstDoc = req.files?.gst_doc?.[0] || null;

    await client.query("BEGIN");

    // default password
    const defaultPassword = "vendor12345";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // create user
    const userResult = await client.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES ($1, $2, $3, $4, 'VENDOR')
       RETURNING id, name, email, phone, role;`,
      [owner_name, email, phone, hashedPassword]
    );
    const user = userResult.rows[0];

    // create vendor with optional GST & docs
    const vendorResult = await client.query(
      `INSERT INTO vendors (
        service, address, pincode, city, state,
        user_id, business_name,
        gst_number, company_doc, gst_doc
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *;`,
      [
        service_id,
        address,
        zip_code,
        city,
        state,
        user.id,
        business_name,
        gst_number || null,
        companyDoc ? companyDoc.path : null, // store local path for now
        gstDoc ? gstDoc.path : null,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Vendor created successfully",
      defaultPassword,
      user,
      vendor: vendorResult.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating vendor:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};


// ==========================
// PUT /superadmin/vendors/:id
// ==========================
 const updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { service, address, pincode, city, state } = req.body;

    const query = `
      UPDATE vendors
      SET service = $1, address = $2, pincode = $3, city = $4, state = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *;  
    `;
    const values = [service, address, pincode, city, state, id];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating vendor:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==================================
// PATCH /superadmin/vendors/:id/verify
// ==================================
 const verifyVendor = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      UPDATE vendors
      SET verified = TRUE, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error verifying vendor:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==============================
// DELETE /superadmin/vendors/:id
// ==============================
 const deleteVendor = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN");

    // find vendor to get user_id
    const vendorResult = await client.query(
      "SELECT user_id FROM vendors WHERE id = $1;",
      [id]
    );

    if (vendorResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Vendor not found" });
    }

    const userId = vendorResult.rows[0].user_id;

    // delete vendor
    await client.query("DELETE FROM vendors WHERE id = $1;", [id]);

    // delete user
    await client.query("DELETE FROM users WHERE id = $1;", [userId]);

    await client.query("COMMIT");

    res.json({ message: "Vendor and associated user deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting vendor:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};
//-------FETCH_ZIP -------
 const lookupZip = async (req, res) => {
  try {
    const { zip } = req.query;
    if (!zip) {
      return res.status(400).json({ error: "ZIP code is required" });
    }

    const apiUrl = `http://www.postalpincode.in/api/pincode/${zip}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.Status === "Success" && data.PostOffice?.length > 0) {
      const city = data.PostOffice[0].District;
      const state = data.PostOffice[0].State;

      return res.json({ city, state });
    } else {
      return res.status(404).json({ error: "Invalid or not found" });
    }
  } catch (err) {
    console.error("Zip lookup error:", err);
    return res.status(500).json({ error: "Lookup failed" });
  }
};

// /api/lookupLatLng.js  (Next.js API route or Express controller)
 const lookupLatLng = async (req, res) => {
try {
const { pincode } = req.query;

if (!pincode) {
  return res.status(400).json({
    error: "Pincode is required",
  });
}

// Validate Indian pincode
if (!/^\d{6}$/.test(pincode)) {
  return res.status(400).json({
    error: "Please enter a valid 6-digit pincode",
  });
}

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  return res.status(500).json({
    error: "Google API key is not configured",
  });
}

const apiUrl =
  `https://maps.googleapis.com/maps/api/geocode/json` +
  `?address=${encodeURIComponent(`${pincode}, India`)}` +
  `&region=in` +
  `&key=${apiKey}`;

const response = await fetch(apiUrl);
const data = await response.json();

if (data.status !== "OK" || !data.results?.length) {
  return res.status(404).json({
    error: "No location found for this pincode",
    googleStatus: data.status,
  });
}

const result = data.results[0];

const { lat, lng } = result.geometry.location;

// Get a component using one exact Google address type
const getComponentByType = (type) => {
  const component = result.address_components.find((item) =>
    item.types.includes(type)
  );

  return component?.long_name || null;
};

/*
  IMPORTANT:

  For Indian pincodes, Google may return:

  locality:
  Kabir Chak

  administrative_area_level_2:
  Darbhanga

  We prioritize administrative_area_level_2 because
  it is the larger district/city area needed here.
*/

const city =
  getComponentByType("administrative_area_level_3") ||
  getComponentByType("postal_town") ||
  getComponentByType("locality");

const state = getComponentByType(
  "administrative_area_level_1"
);

const country = getComponentByType("country");

const returnedPincode = getComponentByType(
  "postal_code"
);

// Keep locality separately if needed
const locality = getComponentByType("locality");

console.log("Location details:", {
  pincode: returnedPincode || pincode,
  latitude: lat,
  longitude: lng,
  locality,
  city,
  state,
  country,
  formattedAddress: result.formatted_address,
});

return res.status(200).json({
  success: true,

  pincode: returnedPincode || pincode,

   lat,
   lng,

  // Kabir Chak
  locality,

  // Darbhanga
  city,

  // Bihar
  state,

  country,

  formattedAddress: result.formatted_address,
});


} catch (error) {
console.error(
"Error fetching coordinates:",
error
);


return res.status(500).json({
  error: "Server error while fetching location",
});


}
};




// ==========================
// 📋 Get All Franchise Types
// ==========================
const getFranchiseTypes = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM franchise_types ORDER BY franchise_type ASC"
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error("❌ Error fetching franchise types:", err);
    res.status(500).json({ error: "Server error" });
  }
};
const addFranchiseType = async (req, res) => {
  const { franchise_type } = req.body;

  if (!franchise_type) {
    return res.status(400).json({ error: "Franchise type is required" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO franchise_types (franchise_type) VALUES ($1) RETURNING *",
      [franchise_type.trim()]
    );

    res.status(201).json({
      message: "Franchise type added successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error adding franchise type:", err);
    if (err.code === "23505") {
      // unique violation
      return res.status(400).json({ error: "Franchise type already exists" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// ❌ Delete Franchise Type
// ==========================
const deleteFranchiseType = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM franchise_types WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Franchise type not found" });
    }

    res.json({ message: "Franchise type deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting franchise type:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// ➕ Add City
// ==========================
const addCity = async (req, res) => {
  const { city_name } = req.body;

  if (!city_name) {
    return res.status(400).json({ error: "City name is required" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO city_lists (city_name) VALUES ($1) RETURNING *",
      [city_name.trim()]
    );

    res.status(201).json({
      message: "City added successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error adding city:", err);
    if (err.code === "23505") {
      return res.status(400).json({ error: "City already exists" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// ❌ Delete City
// ==========================
const deleteCity = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM city_lists WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "City not found" });
    }

    res.json({ message: "City deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting city:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// 📋 Get All Cities
// ==========================
const getCities = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM city_lists ORDER BY city_name ASC"
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error("❌ Error fetching cities:", err);
    res.status(500).json({ error: "Server error" });
  }
};
/**
 * 🟢 Get all promotions
 */
 const getPromotions = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM promotions ORDER BY created_at DESC"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching promotions:", error);
    res.status(500).json({ message: "Server error while fetching promotions" });
  }
};

/**
 * 🟢 Add a new promotion
 */
 const addPromotion = async (req, res) => {
  try {
    const {
      title,
      description,
      discountType,
      discountValue,
      code,
      startDate,
      endDate,
      usageLimit,
    } = req.body;

    if (!title || !description || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const query = `
      INSERT INTO promotions (
        title, description, discount_type, discount_value,
        code, start_date, end_date, usage_limit, is_active, used_count, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 0, NOW(), NOW())
      RETURNING *;
    `;

    const values = [
      title,
      description,
      discountType,
      discountValue,
      code || null,
      startDate,
      endDate,
      usageLimit || null,
    ];

    const result = await pool.query(query, values);
    res.status(201).json({ message: "Promotion created successfully", promotion: result.rows[0] });
  } catch (error) {
    console.error("Error creating promotion:", error);
    res.status(500).json({ message: "Server error while creating promotion" });
  }
};

/**
 * 🟠 Update a promotion
 */
 const updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      discount_type,
      discount_value,
      code,
      start_date,
      end_date,
      usage_limit,
      is_active,
    } = req.body;

    const query = `
      UPDATE promotions
      SET
        title = $1,
        description = $2,
        discount_type = $3,
        discount_value = $4,
        code = $5,
        start_date = $6,
        end_date = $7,
        usage_limit = $8,
        is_active = $9,
        updated_at = NOW()
      WHERE id = $10
      RETURNING *;
    `;

    const values = [
      title,
      description,
      discount_type,
      discount_value,
      code || null,
      start_date,
      end_date,
      usage_limit || null,
      is_active,
      id,
    ];

    const result = await pool.query(query, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Promotion not found" });
    }

    res.status(200).json({ message: "Promotion updated successfully", promotion: result.rows[0] });
  } catch (error) {
    console.error("Error updating promotion:", error);
    res.status(500).json({ message: "Server error while updating promotion" });
  }
};

/**
 * 🔴 Delete a promotion
 */
 const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query("DELETE FROM promotions WHERE id = $1 RETURNING *;", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Promotion not found" });
    }

    res.status(200).json({ message: "Promotion deleted successfully" });
  } catch (error) {
    console.error("Error deleting promotion:", error);
    res.status(500).json({ message: "Server error while deleting promotion" });
  }
};

const getDeliveryPartners = async (req, res) => {
  try {
    const query = `
      SELECT 
        dp.id,
        dp.rider_name,
        u.name AS owner_name,
        u.email,
        u.phone,
        dp.address,
        dp.zip_code,
        dp.city,
        dp.state,
        'India' AS country,
        dp.verified AS is_verified,
        TRUE AS is_active,
        dp.created_at AS joined_at,
        dp.dl_number,
        dp.dl_image,
        0 AS rating,
        0 AS total_deliveries
      FROM delivery_partners dp
      JOIN users u ON dp.user_id = u.id
      ORDER BY dp.created_at DESC;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching delivery partners:", err);
    res.status(500).json({ error: "Server error" });
  }
};
//Groome@1998Password
//ssh root@178.16.137.30
const getFranchises = async (req, res) => {
  try {
    const query = `
      SELECT 
        f.id,
        f.name AS franchise_name,
        u.name AS owner_name,
        u.email,
        u.phone,
        f.address,
        f.zip_code,
        f.city,
        f.state,
        'India' AS country,
        ft.franchise_type AS franchise_type,
        f.verified AS is_verified,
        TRUE AS is_active,
        f.created_at AS joined_at
      FROM franchises f
      JOIN users u ON f.user_id = u.id
      JOIN franchise_types ft ON f.franchise_type_id = ft.id
      ORDER BY f.created_at DESC;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching franchises:", err);
    res.status(500).json({ error: "Server error" });
  }
};
const getUnverifiedInfluencers = async (req, res) => {
  try {
    const query = `
      SELECT
        i.id,
        i.name,
        i.instagram_profile,
        i.state,
        i.content_types,
        i.languages,
        i.profile_picture_url,
        i.about_you,
        i.consent,
        i.is_approved,
        i.show_on_frontend,
        i.created_at AS applied_at,

        -- user details
        u.name AS user_name,
        u.email,
        u.phone

      FROM influencers i
      JOIN users u ON i.user_id = u.id
      WHERE i.is_approved = FALSE
      ORDER BY i.created_at DESC;
    `;

    const result = await pool.query(query);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching unverified influencers:", err);
    res.status(500).json({ error: "Server error" });
  }
};
const verifyinfluencer = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      UPDATE influencers
      SET is_approved = TRUE
      WHERE id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error verifying vendor:", err);
    res.status(500).json({ error: "Server error" });
  }
};
const updateShowOnFrontend = async (req, res) => {
  try {
    const { id, show_on_frontend } = req.body;

    if (typeof show_on_frontend !== "boolean") {
      return res.status(400).json({
        error: "show_on_frontend must be boolean",
      });
    }

    const query = `
      UPDATE influencers
      SET show_on_frontend = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    const result = await pool.query(query, [
      id,
      show_on_frontend,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Influencer not found",
      });
    }

    res.json({
      success: true,
      influencer: result.rows[0],
    });
  } catch (err) {
    console.error("Error updating influencer frontend flag:", err);
    res.status(500).json({ error: "Server error" });
  }
};


const getVerifiedInfluencers = async (req, res) => {
  try {
    const query = `
      SELECT
        i.id,
        i.name,
        i.instagram_profile,
        i.state,
        i.content_types,
        i.languages,
        i.profile_picture_url,
        i.about_you,
        i.consent,
        i.is_approved,
        i.show_on_frontend,
        i.created_at AS applied_at,

        -- user details
        u.name AS user_name,
        u.email,
        u.phone

      FROM influencers i
      JOIN users u ON i.user_id = u.id
      WHERE i.is_approved = TRUE
      ORDER BY i.created_at DESC;
    `;

    const result = await pool.query(query);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching unverified influencers:", err);
    res.status(500).json({ error: "Server error" });
  }
  
};



const getManufacturers = async (req, res) => {
  try {
    const { search, filterStatus } = req.query;

    let query = `
      WITH base_manufacturers AS (
        SELECT 
          m.id,
          m.business_name,
          m.address,
          m.zip_code,
          m.city,
          m.state,
          m.company_doc,
          m.company_id,
          m.verified,

          u.name AS owner_name,
          u.email,
          u.phone,
          m.user_id,

          COALESCE(
            ARRAY_AGG(DISTINCT c.name)
            FILTER (WHERE c.id IS NOT NULL),
            '{}'
          ) AS categories,

          COUNT(DISTINCT p.id) FILTER (
            WHERE (p.selling_price IS NULL OR p.selling_price = 0)
              AND p.seller_type = 'MANUFACTURER'
          ) AS null_price_product_count

        FROM manufacturers m

        JOIN users u
          ON u.id = m.user_id

        LEFT JOIN manufacturer_categories mc
          ON mc.manufacturer_id = m.id

        LEFT JOIN categories c
          ON c.id = mc.category_id

        LEFT JOIN products p
          ON p.user_id = m.user_id

        WHERE 1=1
    `;

    const values = [];

    // Manufacturer verification filter
    if (filterStatus === "verified") {
      query += ` AND m.verified = true`;
    } else if (filterStatus === "unverified") {
      query += ` AND m.verified = false`;
    }

    // Search
    if (search) {
      values.push(`%${search}%`);

      query += `
        AND (
          m.business_name ILIKE $${values.length}
          OR u.name ILIKE $${values.length}
          OR u.email ILIKE $${values.length}
          OR u.phone ILIKE $${values.length}
          OR m.city ILIKE $${values.length}
          OR m.state ILIKE $${values.length}
          OR m.zip_code ILIKE $${values.length}
        )
      `;
    }

    query += `
        GROUP BY
          m.id,
          u.name,
          u.email,
          u.phone
      )
      SELECT 
        bm.*,
        kyc_data.kyc
      FROM base_manufacturers bm
      LEFT JOIN LATERAL (
        SELECT
          json_build_object(
            'id', k.id,
            'account_holder_name', k.account_holder_name,
            'account_number', k.account_number,
            'ifsc', k.ifsc,
             'status', k.status,
            'pan_number', k.pan_number,
            'pan_image_url', k.pan_image_url,
            'document_type', k.document_type,
            'document_front_url', k.document_front_url,
            'document_back_url', k.document_back_url,
            'rejection_reason', k.rejection_reason,
            'verified_at', k.verified_at,
            'verified_by', k.verified_by,
            'created_at', k.created_at,
            'updated_at', k.updated_at
          ) AS kyc
        FROM kyc k
        WHERE k.user_id = bm.id
          AND k.other_type = 'MANUFACTURER'
        ORDER BY k.created_at DESC
        LIMIT 1
      ) kyc_data ON true

      ORDER BY
        bm.verified DESC,
        bm.business_name ASC;
    `;

    const result = await pool.query(query, values);

    res.status(200).json({
      success: true,
      manufacturers: result.rows,
    });
  } catch (err) {
    console.error("Get manufacturers error:", err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};






const getManufacturerById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        m.*,
        u.id AS user_id,
        u.name AS owner_name,
        u.email,
        u.phone,
        COALESCE(
          ARRAY_AGG(DISTINCT c.name) 
          FILTER (WHERE c.id IS NOT NULL), 
          '{}'
        ) AS categories
      FROM manufacturers m
      JOIN users u ON u.id = m.user_id
      LEFT JOIN manufacturer_categories mc ON mc.manufacturer_id = m.id
      LEFT JOIN categories c ON c.id = mc.category_id
      WHERE m.id = $1
      GROUP BY m.id, u.id, u.name, u.email, u.phone;
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Manufacturer not found",
      });
    }

    res.status(200).json({
      success: true,
      manufacturer: result.rows[0],
    });
  } catch (err) {
    console.error("Get manufacturer by ID error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
const verifyManufacturer = async (req, res) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;

    if (typeof verified !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Invalid payload. 'verified' must be a boolean (true or false).",
      });
    }

    const result = await pool.query(
      `
      WITH updated AS (
        UPDATE manufacturers
        SET verified = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      )
      SELECT
        m.*,
        u.id AS user_id,
        u.name AS owner_name,
        u.email,
        u.phone,
        COALESCE(
          ARRAY_AGG(DISTINCT c.name)
          FILTER (WHERE c.id IS NOT NULL),
          '{}'
        ) AS categories
      FROM updated m
      JOIN users u ON u.id = m.user_id
      LEFT JOIN manufacturer_categories mc
        ON mc.manufacturer_id = m.id
      LEFT JOIN categories c
        ON c.id = mc.category_id
      GROUP BY
        m.id,
        m.user_id,
        m.business_name,
        m.company_id,
        m.address,
        m.city,
        m.state,
        m.zip_code,
        m.company_doc,
        m.profile_image,
        m.verified,
        m.created_at,
        m.updated_at,
        u.id,
        u.name,
        u.email,
        u.phone;
      `,
      [verified, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Manufacturer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Manufacturer ${
        verified ? "verified" : "unverified"
      } successfully`,
      manufacturer: result.rows[0],
    });
  } catch (err) {
    console.error("Verify manufacturer error:", err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
const getManufacturerProducts = async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log("Requested userId:", userId, "Type:", typeof userId);
    const query = `
      SELECT 
        p.id,
        p.user_id,
        p.category_id,
        p.sub_category_id,
        p.name,
        p.description,
        p.price,
        p.selling_price,
        p.stock_quantity,
        p.status,
        p.quality_tier,
        p.seller_type,
        p.product_code,
        p.brand_name,
        p.available_sizes,
        p.available_colors,
        p.weight,
        p.dimensions,
        p.specifications,
        p.created_at,
        p.updated_at,
        p.moq,
        p.moq_price,
        c.name AS category_name,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', pi.id,
              'image_url', pi.image_url,
              'is_primary', pi.is_primary
            )
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_images pi ON pi.product_id = p.id
      WHERE p.user_id = $1 
        AND p.seller_type = 'MANUFACTURER'
      GROUP BY p.id, c.name
      ORDER BY p.created_at DESC;
    `;

    const result = await pool.query(query, [userId]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      products: result.rows,
    });
  } catch (err) {
    console.error("Get manufacturer products error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching products",
    });
  }
};
const updateProductTerms = async (req, res) => {
  try {
    const { productId } = req.params;
    const { selling_price, moq, moq_price } = req.body;

    // 1. Basic payload validation
    if (selling_price === undefined || selling_price === null) {
      return res.status(400).json({
        success: false,
        message: "Selling price is required.",
      });
    }

    // 2. Execute SQL Update query
    const query = `
      UPDATE products
      SET 
        selling_price = $1,
        moq = $2,
        moq_price = $3,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING 
        id, 
        name, 
        price, 
        selling_price, 
        moq, 
        moq_price, 
        status, 
        updated_at;
    `;

    const values = [
      selling_price,
      moq !== undefined && moq !== "" ? moq : null,
      moq_price !== undefined && moq_price !== "" ? moq_price : null,
      productId,
    ];

    const result = await pool.query(query, values);

    // 3. Handle product not found
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    // 4. Return updated product data
    res.status(200).json({
      success: true,
      message: "Product superadmin terms updated successfully.",
      product: result.rows[0],
    });
  } catch (err) {
    console.error("Update product terms error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while updating product terms.",
    });
  }
};
const getMalls = async (req, res) => {
  try {
    const { search, filterStatus } = req.query;

    let query = `
      SELECT
        m.id,
        m.business_name,
        m.address,
        m.pincode,
        m.city,
        m.state,
        m.company_doc,
        m.company_id,
        m.map_address,
        m.place_id,
        m.latitude,
        m.longitude,
        m.verified,
        m.created_at,
        m.updated_at,

        u.name AS owner_name,
        u.email,
        u.phone,
        m.user_id,

        COALESCE(
          ARRAY_AGG(DISTINCT c.name)
          FILTER (WHERE c.id IS NOT NULL),
          '{}'
        ) AS categories

      FROM malls m

      JOIN users u
        ON u.id = m.user_id

      LEFT JOIN mall_product_categories mpc
        ON mpc.mall_id = m.id

      LEFT JOIN categories c
        ON c.id = mpc.category_id

      WHERE 1=1
    `;

    const values = [];

    // ============================================
    // FILTER BY VERIFICATION STATUS
    // ============================================
    if (filterStatus === "verified") {
      query += ` AND m.verified = true`;
    } else if (filterStatus === "unverified") {
      query += ` AND m.verified = false`;
    }

    // ============================================
    // SEARCH
    // ============================================
    if (search) {
      values.push(`%${search}%`);

      query += `
        AND (
          m.business_name ILIKE $${values.length}
          OR u.name ILIKE $${values.length}
          OR u.email ILIKE $${values.length}
          OR u.phone ILIKE $${values.length}
          OR m.city ILIKE $${values.length}
          OR m.state ILIKE $${values.length}
          OR m.pincode ILIKE $${values.length}
          OR m.company_id ILIKE $${values.length}
        )
      `;
    }

    // ============================================
    // GROUP + ORDER
    // ============================================
    query += `
      GROUP BY
        m.id,
        u.name,
        u.email,
        u.phone

      ORDER BY
        m.verified DESC,
        m.business_name ASC;
    `;

    const result = await pool.query(query, values);

    return res.status(200).json({
      success: true,
      malls: result.rows,
    });

  } catch (err) {
    console.error("Get malls error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getMallById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        m.*,

        u.id AS user_id,
        u.name AS owner_name,
        u.email,
        u.phone,

        COALESCE(
          ARRAY_AGG(DISTINCT c.name)
          FILTER (WHERE c.id IS NOT NULL),
          '{}'
        ) AS categories

      FROM malls m

      JOIN users u
        ON u.id = m.user_id

      LEFT JOIN mall_product_categories mpc
        ON mpc.mall_id = m.id

      LEFT JOIN categories c
        ON c.id = mpc.category_id

      WHERE m.id = $1

      GROUP BY
        m.id,
        u.id,
        u.name,
        u.email,
        u.phone;
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Mall not found",
      });
    }

    return res.status(200).json({
      success: true,
      mall: result.rows[0],
    });

  } catch (err) {
    console.error("Get mall by ID error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const verifyMall = async (req, res) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;

    // Validate payload
    if (typeof verified !== "boolean") {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payload. 'verified' must be a boolean (true or false).",
      });
    }

    const result = await pool.query(
      `
      UPDATE malls m
      SET
        verified = $1,
        updated_at = NOW()
      FROM users u
      WHERE m.id = $2
        AND u.id = m.user_id
      RETURNING
        m.*,
        u.id AS user_id,
        u.name AS owner_name,
        u.email,
        u.phone,
        COALESCE(
          (
            SELECT ARRAY_AGG(DISTINCT c.name)
            FROM mall_product_categories mpc
            JOIN categories c
              ON c.id = mpc.category_id
            WHERE mpc.mall_id = m.id
          ),
          '{}'
        ) AS categories;
      `,
      [verified, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Mall not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Mall ${
        verified ? "verified" : "unverified"
      } successfully`,
      mall: result.rows[0],
    });
  } catch (err) {
    console.error("Verify mall error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
const updateCredit = async (req, res) => {
  const client = await pool.connect();

  try {
    const { mallId } = req.params;
    const { amount } = req.body;

    // =========================================================
    // 1. BASIC VALIDATION
    // =========================================================

    if (!mallId) {
      return res.status(400).json({
        success: false,
        message: "Mall ID is required",
        statusCode: 400,
      });
    }

    if (
      amount === undefined ||
      amount === null ||
      typeof amount !== "number" ||
      !Number.isFinite(amount)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid credit amount is required",
        statusCode: 400,
      });
    }

    if (amount === 0) {
      return res.status(400).json({
        success: false,
        message: "Credit amount cannot be zero",
        statusCode: 400,
      });
    }

    await client.query("BEGIN");

    // =========================================================
    // 2. GET MALL
    // =========================================================

    const mallResult = await client.query(
      `
      SELECT
        id,
        user_id,
        total_credits
      FROM malls
      WHERE id = $1
      FOR UPDATE
      `,
      [mallId]
    );

    if (mallResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Mall not found",
        statusCode: 404,
      });
    }

    const mall = mallResult.rows[0];

    // =========================================================
    // 3. AUTHORIZATION
    // =========================================================

    

    // =========================================================
    // 4. CALCULATE NEW BALANCE
    // =========================================================

    const currentCredits = Number(mall.total_credits);
    const newCredits = currentCredits + amount;

    if (newCredits < 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Insufficient credits",
        statusCode: 400,
        currentCredits,
        requestedChange: amount,
      });
    }

    // =========================================================
    // 5. UPDATE BALANCE
    // =========================================================

    const updateResult = await client.query(
      `
      UPDATE malls
      SET
        total_credits = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        total_credits,
        updated_at
      `,
      [newCredits, mallId]
    );

    await client.query("COMMIT");

    // =========================================================
    // 6. RESPONSE
    // =========================================================

    return res.status(200).json({
      success: true,
      message: amount > 0
        ? "Credits added successfully"
        : "Credits deducted successfully",
      statusCode: 200,
      mall: updateResult.rows[0],
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Update credit error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update credits",
      statusCode: 500,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  loginSuperadmin,
  getCategories,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
   getServices,
  createService,
  updateService,
  toggleServiceStatus,
  deleteService,

  // banners
  getBanners,
  createBanner,
  updateBanner,
  toggleBannerStatus,
  deleteBanner,

    getVendors,
  createVendor,
  updateVendor,
  verifyVendor,
  deleteVendor,
  lookupZip,
  
  getFranchiseTypes,
  addFranchiseType,
  deleteFranchiseType,
  addCity,
  deleteCity,
  getCities,
  getPromotions,
  addPromotion,
  updatePromotion,
  deletePromotion,
  getDeliveryPartners,
  getFranchises,
  lookupLatLng,
  getUnverifiedInfluencers,
  verifyinfluencer,
  getVerifiedInfluencers,
  updateShowOnFrontend,
  getManufacturers,
  getManufacturerById,
  verifyManufacturer,
  getManufacturerProducts,
  updateProductTerms,
  getMalls,
  getMallById,
  verifyMall,
  updateCredit
};
