const pool = require("../config/db");

// ===========================================
// POST /superadmin/vendors (User + Vendor + Services)
// ===========================================
const createVendor = async (req, res) => {
  const client = await pool.connect();
  const userId = req.user.userId; // decoded JWT from middleware
  
  try {
    let {
      service_ids, // arrives as JSON string in multipart/form-data
      category_ids,
      address,
      zip_code,
      city,
      state,
      business_name,
      gst_number,
      shop_act_number, // 👈 ADD THIS
      map_address,
      latitude,
      longitude,
      place_id,
    } = req.body;

    // 🔹 Convert stringified JSON -> array
    try {
      
      if (typeof service_ids === "string") {
        service_ids = JSON.parse(service_ids);
      }
       if (typeof category_ids === "string") {
    category_ids = JSON.parse(category_ids);
  }
    } catch (e) {
      return res.status(400).json({ error: "Invalid service_ids format" });
    }

    // 🔹 Validate parsed array
    if (!Array.isArray(service_ids) || service_ids.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one valid service must be selected" });
    }

    // 🔹 Check if vendor already exists for this user
    const existingVendor = await client.query(
      "SELECT id, verified FROM vendors WHERE user_id = $1",
      [userId]
    );

    if (existingVendor.rowCount > 0) {
      const vendor = existingVendor.rows[0];
      if (!vendor.verified) {
        return res.status(400).json({
          message: "Your vendor request is pending approval. Please wait.",
        });
      } else {
        return res.status(400).json({
          message: "You are already registered as a verified vendor.",
        });
      }
    }

    // 🔹 Handle file uploads (from Multer)
const companyDoc = req.files?.company_doc?.[0] || null;
const gstDoc = req.files?.gst_doc?.[0] || null;
    await client.query("BEGIN");

    // 1️⃣ Insert into vendors table
    const vendorResult = await client.query(
      `INSERT INTO vendors (
         address, pincode, city, state,
         user_id, business_name,
         gst_number, company_doc, gst_doc,
         shop_act_number, map_address, place_id, latitude, longitude,
         verified
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false)
       RETURNING *;`,
      [
        address,
        zip_code,
        city,
        state,
        userId,
        business_name,
        gst_number || null,
        companyDoc ? `/uploads/${companyDoc.filename}` : null,
gstDoc ? `/uploads/${gstDoc.filename}` : null,
        shop_act_number || null,
        map_address || null,
        place_id || null,
        latitude || null,
        longitude || null,
      ]
    );

    const vendorId = vendorResult.rows[0].id;

    // 2️⃣ Insert related services
    const insertServicesQuery =
      `INSERT INTO vendor_services (vendor_id, service_id) VALUES ` +
      service_ids.map((_, idx) => `($1, $${idx + 2})`).join(", ");

    await client.query(insertServicesQuery, [vendorId, ...service_ids]);
   if (category_ids.length > 0) {
  const insertCategoriesQuery =
    `INSERT INTO vendor_product_categories (vendor_id, category_id) VALUES ` +
    category_ids.map((_, idx) => `($1, $${idx + 2})`).join(", ");

  await client.query(insertCategoriesQuery, [
    vendorId,
    ...category_ids,
  ]);
}
    await client.query("COMMIT");

    res.status(201).json({
      message: "Vendor created successfully",
      vendor: vendorResult.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating vendor:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};

const createMall = async (req, res) => {
  const client = await pool.connect();
  const userId = req.user.userId; // decoded JWT from middleware

  try {
    let {
      address,
      zip_code,
      city,
      state,
      shop_name,
      map_address,
      latitude,
      longitude,
      place_id,
      company_id,
        category_ids,
    } = req.body;

    // 🔹 Handle file upload (from Multer)
    const companyDoc = req.files?.company_doc?.[0] || null;

    // 🔹 Check if mall already exists for this user
    const existingMall = await client.query(
      "SELECT id, verified FROM malls WHERE user_id = $1",
      [userId]
    );

    if (existingMall.rowCount > 0) {
      const mall = existingMall.rows[0];
      if (!mall.verified) {
        return res.status(400).json({
          message: "Your mall request is pending approval. Please wait.",
        });
      } else {
        return res.status(400).json({
          message: "You are already registered as a verified mall.",
        });
      }
    }
    try {
  if (typeof category_ids === "string") {
    category_ids = JSON.parse(category_ids);
  }
} catch (e) {
  return res.status(400).json({
    error: "Invalid category_ids format",
  });
}

if (!Array.isArray(category_ids)) {
  category_ids = [];
}

    await client.query("BEGIN");

    // 1️⃣ Insert into malls table
    const mallResult = await client.query(
      `INSERT INTO malls (
         address, pincode, city, state,
         user_id, business_name,
         company_doc, map_address, place_id,
         latitude, longitude, company_id, verified
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false)
       RETURNING *;`,
      [
        address,
        zip_code,
        city,
        state,
        userId,
        shop_name || "new_business",
          companyDoc ? `/uploads/${companyDoc.filename}` : null,
        map_address || null,
        place_id || null,
        latitude || null,
        longitude || null,
        company_id || null,
      ]
    );
    const mallId = mallResult.rows[0].id;
if (category_ids.length > 0) {
  const insertCategoriesQuery =
    `INSERT INTO mall_product_categories (mall_id, category_id) VALUES ` +
    category_ids.map((_, idx) => `($1, $${idx + 2})`).join(", ");

  await client.query(insertCategoriesQuery, [
    mallId,
    ...category_ids,
  ]);
}
    await client.query("COMMIT");

    res.status(201).json({
      message: "Mall created successfully",
      mall: mallResult.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating mall:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};


const createManufacturer = async (req, res) => {
  const client = await pool.connect();
  const userId = req.user.userId; // decoded JWT from middleware

  try {
    let {
      product_ids, // JSON string or array of UUIDs
      firm_name,
      address,
      zip_code,
      city,
      state,
      manufacturer_number,
     
    } = req.body;

    // 🔹 Parse product_ids (categories)
    try {
      if (typeof product_ids === "string") {
        product_ids = JSON.parse(product_ids);
      }
    } catch (e) {
      return res.status(400).json({ error: "Invalid product_ids format" });
    }

    // 🔹 Validate categories
    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one valid category must be selected" });
    }

    // 🔹 Check if manufacturer already exists for this user
    const existingManufacturer = await client.query(
      "SELECT id, verified FROM manufacturers WHERE user_id = $1",
      [userId]
    );

    if (existingManufacturer.rowCount > 0) {
      const manufacturer = existingManufacturer.rows[0];
      if (!manufacturer.verified) {
        return res.status(400).json({
          message: "Your manufacturer request is pending approval. Please wait.",
        });
      } else {
        return res.status(400).json({
          message: "You are already registered as a verified manufacturer.",
        });
      }
    }

    // 🔹 Handle optional file uploads (Multer)
    const companyDoc = req.files?.company_doc?.[0] || null;

    await client.query("BEGIN");

    // 1️⃣ Insert manufacturer record
    const manufacturerResult = await client.query(
      `INSERT INTO manufacturers (
         address, zip_code, city, state,
         user_id, business_name,
         company_doc, company_id, verified
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)
       RETURNING *;`,
      [
        address,
        zip_code,
        city,
        state,
        userId,
        firm_name, // maps to business_name
          companyDoc ? `/uploads/${companyDoc.filename}` : null,
        manufacturer_number || null,
      ]
    );

    const manufacturerId = manufacturerResult.rows[0].id;

    // 2️⃣ Insert related categories into manufacturer_categories
    const insertCategoriesQuery =
      `INSERT INTO manufacturer_categories (manufacturer_id, category_id) VALUES ` +
      product_ids.map((_, idx) => `($1, $${idx + 2})`).join(", ");

    await client.query(insertCategoriesQuery, [manufacturerId, ...product_ids]);

    await client.query("COMMIT");

    res.status(201).json({
      message: "Manufacturer created successfully",
      manufacturer: manufacturerResult.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating manufacturer:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};

const createDeliveryPartner = async (req, res) => {
  const client = await pool.connect();
  const userId = req.user.userId; // decoded JWT from middleware

  try {
    const {
      rider_name,
      address,
      zip_code,
      city,
      state,
      dl_number,
    } = req.body;

    // 🔹 Check if required fields are present
    if (!rider_name || !address || !zip_code || !city || !state) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 🔹 Check if delivery partner already exists for this user
    const existingPartner = await client.query(
      "SELECT id, verified FROM delivery_partners WHERE user_id = $1",
      [userId]
    );

    if (existingPartner.rowCount > 0) {
      const partner = existingPartner.rows[0];
      if (!partner.verified) {
        return res.status(400).json({
          message: "Your delivery partner request is pending approval. Please wait.",
        });
      } else {
        return res.status(400).json({
          message: "You are already registered as a verified delivery partner.",
        });
      }
    }

    // 🔹 Handle optional file upload (Multer)
    const dlImage = req.files?.dl_image?.[0] || null;

    await client.query("BEGIN");

    // 1️⃣ Insert new delivery partner record
    const insertQuery = `
      INSERT INTO delivery_partners (
        rider_name, address, zip_code, city, state,
        dl_number, dl_image, user_id, verified
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)
      RETURNING *;
    `;

    const insertValues = [
      rider_name,
      address,
      zip_code,
      city,
      state,
      dl_number || null,
      dlImage ? `/uploads/${dlImage.filename}` : null,
      userId,
    ];

    const result = await client.query(insertQuery, insertValues);

    await client.query("COMMIT");

    res.status(201).json({
      message: "Delivery partner created successfully",
      partner: result.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating delivery partner:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};



const createFranchise = async (req, res) => {
  const client = await pool.connect();
  const userId = req.user.userId; // decoded JWT from middleware
console.log("📦 req.body:", req.body);
  try {
    const {
      name,
      address,
      zip_code,
      city,
      state,
      franchise_type_id,
    } = req.body;

    // 🔹 Validate required fields
    if (!name || !address || !zip_code || !city || !state || !franchise_type_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 🔹 Check if franchise already exists for this user
    const existingFranchise = await client.query(
      "SELECT id, verified FROM franchises WHERE user_id = $1",
      [userId]
    );

    if (existingFranchise.rowCount > 0) {
      const franchise = existingFranchise.rows[0];
      if (!franchise.verified) {
        return res.status(400).json({
          message: "Your franchise request is pending approval. Please wait.",
        });
      } else {
        return res.status(400).json({
          message: "You are already registered as a verified franchise.",
        });
      }
    }

    await client.query("BEGIN");

    // 1️⃣ Insert new franchise record
    const insertQuery = `
      INSERT INTO franchises (
        name, address, zip_code, city, state, user_id, franchise_type_id, verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, false)
      RETURNING *;
    `;

    const insertValues = [
      name,
      address,
      zip_code,
      city,
      state,
      userId,
      franchise_type_id,
    ];

    const result = await client.query(insertQuery, insertValues);

    await client.query("COMMIT");

    res.status(201).json({
      message: "Franchise created successfully",
      franchise: result.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating franchise:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};

const createInfluencer = async (req, res) => {
  const client = await pool.connect();
  const userId = req.user.userId; // decoded JWT from middleware

  try {
    let {
      name,
      instagram_profile,
      state,
      content_types, // arrives as JSON string in multipart/form-data
      languages, // comes as JSON string from form-data
      about_you,
      consent,
      show_on_frontend,
      city
    } = req.body;

    // 🔹 Convert languages string -> array
    try {
      if (typeof languages === "string") {
        languages = JSON.parse(languages);
      }
    } catch (e) {
      return res.status(400).json({ error: "Invalid languages format" });
    }
try {
  if (typeof content_types === "string") {
    content_types = JSON.parse(content_types);
  }
} catch (e) {
  return res.status(400).json({
    error: "Invalid content types format",
  });
}
    // 🔹 Validate required fields
    if (!name || !instagram_profile || !state || !content_types) {
      return res
        .status(400)
        .json({ error: "Name, Instagram, State, and Content Type are required" });
    }

    if (!Array.isArray(languages) || languages.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one language must be selected" });
    }

    if (consent !== "true" && consent !== true) {
      return res
        .status(400)
        .json({ error: "Consent must be given to proceed" });
    }

    // 🔹 Handle profile picture upload (optional)
    const profilePic = req.files?.profile_picture?.[0] || null;

    // 🔹 Check if influencer already exists for this user
    const existing = await client.query(
      "SELECT id, is_approved FROM influencers WHERE user_id = $1",
      [userId]
    );

    if (existing.rowCount > 0) {
      const inf = existing.rows[0];
      if (!inf.is_approved) {
        return res.status(400).json({
          message: "Your influencer request is pending approval. Please wait.",
        });
      } else {
        return res.status(400).json({
          message: "You are already registered as a verified influencer.",
        });
      }
    }

    await client.query("BEGIN");

    // 1️⃣ Insert influencer
    const influencerResult = await client.query(
      `INSERT INTO influencers (
        user_id, name, instagram_profile, state, content_types,
        languages, profile_picture_url, about_you, consent, show_on_frontend, city
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;`,
      [
        userId,
        name,
        instagram_profile,
        state,
        content_types,
        languages,
        profilePic ? `/uploads/${profilePic.filename}` : null,

        about_you || null,
        consent === "true" || consent === true,
        show_on_frontend === "true" || show_on_frontend === true,
        city || null
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Influencer created successfully",
      influencer: influencerResult.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating influencer:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};

module.exports = {
  createVendor,
  createMall,
  createManufacturer,
  createDeliveryPartner,
  createFranchise,
  createInfluencer
};
