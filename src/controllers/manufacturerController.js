// src/controllers/authController.js
const userModel = require("../models/userModel");
const verificationModel = require("../models/verificationModel");
const { hashPassword, comparePassword } = require("../utils/hash");
const { generateCode } = require("../utils/generateCode");
const emailService = require("../services/emailService");
const jwt = require("jsonwebtoken");
const { saveRefreshToken, getRefreshToken, deleteRefreshToken } = require("../models/tokenModel");
const pool = require("../config/db");
const path = require("path");
const fs = require("fs");
const VERIFICATION_EXP_MINUTES = 10;
// controllers/authController.js

const crypto = require("crypto");

// helper to generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// -------------------- LOGIN FLOW --------------------
async function login(req, res) {
  try {
    const { phone, password } = req.body;

    // 1. Validate input
    if (!phone || !password) {
      return res.status(400).json({
        message: "Phone and password required",
      });
    }

    const inputPhone = phone.trim();

    // 2. Check if user exists
    const user = await userModel.getUserByPhone(inputPhone);

    if (!user) {
      return res.status(401).json({
        message: "No user found",
      });
    }

    // 3. Validate password
    const isValid = await comparePassword(
      password,
      user.password
    );

    if (!isValid) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // 4. Check if manufacturer exists for this user
    const { rows: manufacturerRows } = await pool.query(
      `
        SELECT *
        FROM manufacturers
        WHERE user_id = $1
      `,
      [user.id]
    );

    if (!manufacturerRows.length) {
      return res.status(403).json({
        message: "Manufacturer not onboarded",
      });
    }

    const manufacturer = manufacturerRows[0];

    // 5. Check if manufacturer is verified
    if (!manufacturer.verified) {
      return res.status(403).json({
        message:
          "Manufacturer not verified. Please wait for verification to complete",
      });
    }

    // 6. Create access token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        manufacturerId: manufacturer.id,
        businessName: manufacturer.business_name,
        userType: "MANUFACTURER",
      },
      process.env.ACCESS_TOKEN_VENDOR,
      {
        expiresIn: "1d",
      }
    );

    // 7. Create refresh token
    const refreshToken = jwt.sign(
      {
        userId: user.id,
        userType: "MANUFACTURER",
      },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: "1y",
      }
    );

    // 8. Save refresh token with user type
    await saveRefreshToken(
      user.id,
      refreshToken,
      "MANUFACTURER"
    );

    // 9. Send response
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },

      manufacturer: {
        id: manufacturer.id,
        businessName: manufacturer.business_name,
        address: manufacturer.address,
        zipCode: manufacturer.zip_code,
        city: manufacturer.city,
        state: manufacturer.state,
        verified: manufacturer.verified,
        companyDoc: manufacturer.company_doc,
        companyId: manufacturer.company_id,
        createdAt: manufacturer.created_at,
        updatedAt: manufacturer.updated_at,
      },

      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("Manufacturer login error:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
}
// GET /vendors/webflow/categories
async function webflow(req, res) {
  try {
    const categoriesResult = await pool.query(`
      WITH RECURSIVE category_tree AS (

        -- Get all root categories
        SELECT
          c.*,
          0 AS depth
        FROM categories c
        WHERE c.parent_id IS NULL

        UNION ALL

        -- Recursively get all children
        SELECT
          child.*,
          parent.depth + 1 AS depth
        FROM categories child
        INNER JOIN category_tree parent
          ON child.parent_id = parent.id
      )

      SELECT *
      FROM category_tree
      WHERE is_active = true
      ORDER BY depth ASC, sort_order ASC, name ASC
    `);

    const rows = categoriesResult.rows;

    // Create map of all categories
    const categoryMap = new Map();

    rows.forEach((category) => {
      categoryMap.set(category.id, {
        ...category,
        children: [],
      });
    });

    // Build hierarchy
    const categories = [];

    rows.forEach((category) => {
      const current = categoryMap.get(category.id);

      if (category.parent_id && categoryMap.has(category.parent_id)) {
        categoryMap
          .get(category.parent_id)
          .children.push(current);
      } else {
        categories.push(current);
      }
    });

    return res.json({
      categories,
    });
  } catch (err) {
    console.error("Error fetching categories:", err);

    return res.status(500).json({
      message: "Failed to load categories",
    });
  }
}

async function createProduct(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userId = req.user.manufacturerId;

    const {
      product_code,
      name,
      brand_name,
      description,
      category_id,
      sub_category_id,
      mrp,
      selling_price,
      stockQuantity,
      quality_tier,
      available_sizes,
      available_colors,
      weight,
      dimensions,
      specifications,
      // NEW FIELDS
      hsn_code,
      gst_percentage,
      quality_tier_description,
      media_details
    } = req.body;

    // ============================================================
    // Handle Files from upload.fields()
    // ============================================================
    const files = req.files || {};
    
    // Get the images array (defaults to empty array if none)
    const uploadedImages = files['images'] || [];
    
    // Get the auth letter (Multer stores it as an array of length 1, so we grab index 0)
    const authLetterArray = files['brand_authorisation_letter'] || [];
    const authLetterFile = authLetterArray.length > 0 ? authLetterArray[0] : null;
    
    // Create the path for the authorisation letter if it exists
    const brandAuthLetterPath = authLetterFile ? `/uploads/${authLetterFile.filename}` : null;

    const sellerType = "MANUFACTURER";

    // ============================================================
    // Parse JSON fields coming from FormData
    // ============================================================
    let parsedSizes = [];
    let parsedColors = [];
    let parsedSpecifications = [];
    let parsedMediaDetails = [];

    try {
      if (available_sizes) parsedSizes = JSON.parse(available_sizes);
      if (available_colors) parsedColors = JSON.parse(available_colors);
      if (specifications) parsedSpecifications = JSON.parse(specifications);
      if (media_details) parsedMediaDetails = JSON.parse(media_details);
    } catch (jsonError) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Invalid JSON data for product variants, specifications, or media details",
        error: jsonError.message,
      });
    }

    // ============================================================
    // Basic validation
    // ============================================================
    if (!name || !name.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Product name is required" });
    }

    if (!mrp || Number(mrp) <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Valid MRP is required" });
    }

    if (uploadedImages.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "At least one product image/video is required" });
    }

    // ============================================================
    // Insert Product
    // ============================================================
    const productResult = await client.query(
      `
      INSERT INTO products (
        user_id,
        category_id,
        sub_category_id,
        product_code,
        name,
        brand_name,
        description,
        price,
        selling_price,
        stock_quantity,
        quality_tier,
        seller_type,
        available_sizes,
        available_colors,
        weight,
        dimensions,
        specifications,
        hsn_code,
        gst_percentage,
        quality_tier_description,
        brand_authorisation_letter
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
        $11, $12, $13::jsonb, $14::jsonb, $15, $16, $17::jsonb, 
        $18, $19, $20, $21
      )
      RETURNING *
      `,
      [
        userId,
        category_id || null,
        sub_category_id || null,
        product_code?.trim() || null,
        name.trim(),
        brand_name?.trim() || null,
        description?.trim() || null,
        Number(mrp) || 0,
        Number(selling_price) || 0,
        Number(stockQuantity) || 0,
        quality_tier || "Budget Quality",
        sellerType,
        JSON.stringify(parsedSizes),
        JSON.stringify(parsedColors),
        weight?.trim() || null,
        dimensions?.trim() || null,
        JSON.stringify(parsedSpecifications),
        // NEW FIELDS INSERTION
        hsn_code?.trim() || null,
        gst_percentage ? Number(gst_percentage) : null,
        quality_tier_description?.trim() || null,
        brandAuthLetterPath
      ]
    );

    const product = productResult.rows[0];

    // ============================================================
    // Insert Product Images & Videos
    // ============================================================
    for (let i = 0; i < uploadedImages.length; i++) {
      const file = uploadedImages[i];
      
      // Match the file uploaded to the media_details array sent from frontend
      // Originalname from multer matches the file.name from the frontend File object
      const matchingDetail = parsedMediaDetails.find(d => d.file_name === file.originalname);
      const mediaType = matchingDetail ? matchingDetail.media_type : 'image';

      await client.query(
        `
        INSERT INTO product_images (
          product_id,
          image_url,
          is_primary,
          sort_order,
          media_type
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          product.id,
          `/uploads/${file.filename}`,
          i === 0,
          i,
          mediaType // Inserts 'video' or 'image'
        ]
      );
    }

    await client.query("COMMIT");

    // ============================================================
    // Return complete product with images
    // ============================================================
    const completeProduct = await client.query(
      `
      SELECT
        p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'image_url', pi.image_url,
              'is_primary', pi.is_primary,
              'sort_order', pi.sort_order,
              'media_type', pi.media_type
            )
            ORDER BY pi.sort_order
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'::json
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1
      GROUP BY p.id
      `,
      [product.id]
    );

    return res.status(201).json({
      success: true,
      message: "Manufacturer product created successfully",
      product: completeProduct.rows[0],
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create Manufacturer Product Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  } finally {
    client.release();
  }
}
async function getProducts(req, res) {
  try {
    const userId = req.user.manufacturerId;

    const result = await pool.query(
      `
      WITH RECURSIVE CategoryPath AS (
        -- Base Case: Get the deepest category for the user's products
        SELECT 
          DISTINCT p.category_id AS target_id,
          c.id, 
          c.parent_id, 
          c.name, 
          1 AS level
        FROM products p
        JOIN categories c ON c.id = p.category_id
        WHERE p.user_id = $1 AND p.seller_type = 'MANUFACTURER'

        UNION ALL

        -- Recursive Step: Traverse UP the tree to find all parents
        SELECT 
          cp.target_id,
          c.id, 
          c.parent_id, 
          c.name, 
          cp.level + 1
        FROM categories c
        INNER JOIN CategoryPath cp ON c.id = cp.parent_id
      ),
      CategoryHierarchy AS (
        -- Aggregate the paths into a JSON array, ordered from Root to Leaf
        SELECT 
          target_id,
          json_agg(
            json_build_object('id', id, 'name', name) ORDER BY level DESC
          ) AS hierarchy
        FROM CategoryPath
        GROUP BY target_id
      ),
      ProductImagesAgg AS (
        -- Aggregate the images BEFORE joining, to avoid GROUP BY errors later
        SELECT 
          product_id,
          json_agg(
            json_build_object(
              'id', id,
              'image_url', image_url,
              'is_primary', is_primary,
              'sort_order', sort_order,
              'media_type', media_type
            )
            ORDER BY sort_order
          ) AS images
        FROM product_images
        GROUP BY product_id
      )
      
      -- Final Select (No GROUP BY needed here anymore!)
      SELECT
        p.*,
        ch.hierarchy AS category_hierarchy,
        COALESCE(pi.images, '[]'::json) AS images
      FROM products p
      LEFT JOIN CategoryHierarchy ch
        ON p.category_id = ch.target_id
      LEFT JOIN ProductImagesAgg pi
        ON p.id = pi.product_id
      WHERE p.user_id = $1
        AND p.seller_type = 'MANUFACTURER'
      ORDER BY p.created_at DESC
      `,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get Products Error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
}
async function updateProduct(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userId = req.user.userId;
    const { id } = req.params;

    const {
      product_code,
      name,
      brand_name,
      description,
      category_id,
      sub_category_id,
      mrp,
      selling_price,
      stockQuantity,
      quality_tier,
      available_sizes,
      available_colors,
      weight,
      dimensions,
      specifications,
      existingImages,
      // NEW FIELDS
      hsn_code,
      gst_percentage,
      quality_tier_description,
      media_details
    } = req.body;

    // ============================================================
    // Handle Files from upload.fields()
    // ============================================================
    const files = req.files || {};
    
    // Get the newly uploaded images/videos
    const uploadedImages = files['images'] || [];
    
    // Get the auth letter (if they uploaded a new one during this edit)
    const authLetterArray = files['brand_authorisation_letter'] || [];
    const authLetterFile = authLetterArray.length > 0 ? authLetterArray[0] : null;
    const brandAuthLetterPath = authLetterFile ? `/uploads/${authLetterFile.filename}` : null;

    // Parse JSON fields
    const parsedSizes = available_sizes ? JSON.parse(available_sizes) : [];
    const parsedColors = available_colors ? JSON.parse(available_colors) : [];
    const parsedSpecifications = specifications ? JSON.parse(specifications) : [];
    const keepImages = existingImages ? JSON.parse(existingImages) : [];
    const parsedMediaDetails = media_details ? JSON.parse(media_details) : [];

    // ============================================================
    // Update product
    // ============================================================
    const result = await client.query(
      `
      UPDATE products
      SET
        product_code               = $1,
        name                       = $2,
        brand_name                 = $3,
        description                = $4,
        category_id                = $5,
        sub_category_id            = $6,
        price                      = $7,
        selling_price              = $8,
        stock_quantity             = $9,
        quality_tier               = $10,
        available_sizes            = $11::jsonb,
        available_colors           = $12::jsonb,
        weight                     = $13,
        dimensions                 = $14,
        specifications             = $15::jsonb,
        hsn_code                   = $16,
        gst_percentage             = $17,
        quality_tier_description   = $18,
        brand_authorisation_letter = COALESCE($19, brand_authorisation_letter),
        updated_at                 = CURRENT_TIMESTAMP
      WHERE id = $20
        AND user_id = $21
        AND seller_type = 'MANUFACTURER'
      RETURNING *
      `,
      [
        product_code || null,
        name,
        brand_name || null,
        description || null,
        category_id || null,
        sub_category_id || null,
        Number(mrp) || 0,
        Number(selling_price) || 0,
        Number(stockQuantity) || 0,
        quality_tier || "Budget Quality",
        JSON.stringify(parsedSizes),
        JSON.stringify(parsedColors),
        weight || null,
        dimensions || null,
        JSON.stringify(parsedSpecifications),
        // NEW FIELDS
        hsn_code || null,
        gst_percentage ? Number(gst_percentage) : null,
        quality_tier_description || null,
        brandAuthLetterPath, // COALESCE prevents overriding the old letter if they didn't upload a new one
        id,
        userId,
      ]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Product not found" });
    }

    // ============================================================
    // Process Existing Images
    // ============================================================
    const dbImages = await client.query(
      `SELECT id, image_url FROM product_images WHERE product_id = $1 ORDER BY sort_order`,
      [id]
    );

    // Remove deleted images
    for (const img of dbImages.rows) {
      if (!keepImages.includes(img.image_url)) {
        const filePath = path.join(
          __dirname,
          "..",
          img.image_url.replace(/^\/+/, "")
        );

        fs.unlink(filePath, () => {});

        await client.query(
          `DELETE FROM product_images WHERE id = $1`,
          [img.id]
        );
      }
    }

    // ============================================================
    // Insert Newly Uploaded Images & Videos
    // ============================================================
    const remainingCount = await client.query(
      `SELECT COUNT(*) FROM product_images WHERE product_id = $1`,
      [id]
    );

    let sortOrder = Number(remainingCount.rows[0].count);

    for (const file of uploadedImages) {
      // Find out if the file is a video or image based on media_details
      const matchingDetail = parsedMediaDetails.find(d => d.file_name === file.originalname);
      const mediaType = matchingDetail ? matchingDetail.media_type : 'image';

      await client.query(
        `
        INSERT INTO product_images (
          product_id,
          image_url,
          is_primary,
          sort_order,
          media_type
        )
        VALUES ($1,$2,$3,$4,$5)
        `,
        [
          id,
          `/uploads/${file.filename}`,
          false,
          sortOrder++,
          mediaType
        ]
      );
    }

    // ============================================================
    // Ensure one primary image exists
    // ============================================================
    await client.query(
      `
      UPDATE product_images
      SET is_primary = false
      WHERE product_id = $1
      `,
      [id]
    );

    await client.query(
      `
      UPDATE product_images
      SET is_primary = true
      WHERE id = (
        SELECT id
        FROM product_images
        WHERE product_id = $1
        ORDER BY sort_order
        LIMIT 1
      )
      `,
      [id]
    );

    await client.query("COMMIT");

    // ============================================================
    // Return updated product
    // ============================================================
    const product = await client.query(
      `
      SELECT
        p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'image_url', pi.image_url,
              'is_primary', pi.is_primary,
              'sort_order', pi.sort_order,
              'media_type', pi.media_type
            )
            ORDER BY pi.sort_order
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'::json
        ) AS images
      FROM products p
      LEFT JOIN product_images pi
        ON pi.product_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
      `,
      [id]
    );

    return res.json({
      success: true,
      message: "Product updated successfully",
      product: product.rows[0],
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update Product Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: process.env.NODE_ENV === "development"
        ? err.message
        : undefined,
    });

  } finally {
    client.release();
  }
}
async function deleteProduct(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userId = req.user.manufacturerId;
    const { id } = req.params;

    const imagesResult = await client.query(
      `
      SELECT image_url
      FROM product_images pi
      JOIN products p
        ON p.id = pi.product_id
      WHERE pi.product_id = $1
      AND p.user_id = $2
      `,
      [id, userId]
    );

    for (const image of imagesResult.rows) {
      const filePath = path.join(
        __dirname,
        "..",
        image.image_url
      );

      fs.unlink(filePath, () => {});
    }

    const result = await client.query(
      `
      DELETE FROM products
      WHERE id = $1
      AND user_id = $2
      RETURNING *
      `,
      [id, userId]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Product not found"
      });
    }

    await client.query("COMMIT");

    res.json({
      message: "Product deleted"
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({
      message: "Failed to delete product"
    });
  } finally {
    client.release();
  }
}
module.exports = {

  login,
  webflow,
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct
};
