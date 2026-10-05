const userModel = require("../models/userModel");
const { comparePassword } = require("../utils/hash");
const jwt = require("jsonwebtoken");
const {
  saveRefreshToken,
} = require("../models/tokenModel");
const pool = require("../config/db");

async function login(req, res) {
  try {
    const { phone, password } = req.body;

    // 1. Validate input
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone and password required",
      });
    }

    const inputPhone = phone.trim();

    // 2. Find user
    const user = await userModel.getUserByPhone(inputPhone);

    if (!user) {
      return res.status(401).json({
        success: false,
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
        success: false,
        message: "Invalid credentials",
      });
    }

    // 4. Check if mall exists for this user
    const { rows: mallRows } = await pool.query(
      `
      SELECT
        id,
        user_id,
        business_name,
        address,
        map_address,
        pincode,
        city,
        state,
        verified,
        company_doc,
        place_id,
        latitude,
        longitude,
        company_id,
        total_credits
      FROM malls
      WHERE user_id = $1
      `,
      [user.id]
    );

    if (!mallRows.length) {
      return res.status(403).json({
        success: false,
        message: "Mall not onboarded",
      });
    }

    const mall = mallRows[0];

    // 5. Check mall verification
    if (!mall.verified) {
      return res.status(403).json({
        success: false,
        message:
          "Mall not verified. Please wait for verification to complete",
      });
    }

    // 6. Create access token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        mallId: mall.id,
        businessName: mall.business_name,
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
      },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: "1y",
      }
    );

    // 8. Save refresh token
    await saveRefreshToken(
      user.id,
      refreshToken,
      "MALL"
    );

    // 9. Send response
    return res.json({
      success: true,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },

      mall: {
        id: mall.id,
        businessName: mall.business_name,
        address: mall.address,
        mapAddress: mall.map_address,
        pincode: mall.pincode,
        city: mall.city,
        state: mall.state,

        placeId: mall.place_id,
        latitude: mall.latitude,
        longitude: mall.longitude,

        companyId: mall.company_id,

        totalCredits: mall.total_credits,
      },

      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("Mall Login error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}
const getManufacturerProducts = async (req, res) => {
  try {
    const mallId = req.user.mallId;
    const sellerType = "MANUFACTURER";

    if (!mallId) {
      return res.status(401).json({
        success: false,
        message: "Mall not authenticated",
      });
    }

    const result = await pool.query(
      `
      SELECT 
        p.*,

        m.business_name,
        m.profile_image,

        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'image_url', pi.image_url,
              'is_primary', pi.is_primary,
              'sort_order', pi.sort_order
            )
            ORDER BY pi.sort_order ASC, pi.id ASC
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'::json
        ) AS images

      FROM products p

      INNER JOIN manufacturers m
        ON m.user_id = p.user_id

      LEFT JOIN product_images pi
        ON pi.product_id = p.id

      WHERE p.seller_type = $1
        AND p.selling_price > 0

        -- Don't return products already listed by this mall
        AND NOT EXISTS (
          SELECT 1
          FROM mall_products mp
          WHERE mp.mall_id = $2
            AND mp.product_id = p.id
        )

      GROUP BY
        p.id,
        m.business_name,
        m.profile_image

      ORDER BY p.created_at DESC
      `,
      [sellerType, mallId]
    );

    return res.status(200).json({
      success: true,
      products: result.rows,
    });

  } catch (error) {
    console.error("Get manufacturer products error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch manufacturer products",
    });
  }
};
const listProduct = async (req, res) => {
  const client = await pool.connect();

  try {
    const mallId = req.user.mallId;
    const { product_id } = req.body;

    if (!mallId) {
      return res.status(401).json({
        success: false,
        message: "Mall not authenticated",
      });
    }

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: "product_id is required",
      });
    }

    await client.query("BEGIN");

    // --------------------------------------------------
    // 1. Verify product is eligible to be listed
    // --------------------------------------------------
    const productResult = await client.query(
      `
      SELECT
        id,
        name,
        selling_price,
        seller_type,
        status
      FROM products
      WHERE id = $1
        AND seller_type = 'MANUFACTURER'
        AND selling_price > 0
        AND status = 'active'
      FOR UPDATE
      `,
      [product_id]
    );

    if (productResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Product is not available for listing",
      });
    }

    const product = productResult.rows[0];

    const sellingPrice = Number(product.selling_price);

    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Invalid product selling price",
      });
    }

    // --------------------------------------------------
    // 2. Check whether product is already listed
    // --------------------------------------------------
    const existingResult = await client.query(
      `
      SELECT id
      FROM mall_products
      WHERE mall_id = $1
        AND product_id = $2
      `,
      [mallId, product_id]
    );

    if (existingResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Product is already listed in this mall",
      });
    }

    // --------------------------------------------------
    // 3. Lock mall row and check credits
    // --------------------------------------------------
    const mallResult = await client.query(
      `
      SELECT
        id,
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
      });
    }

    const mall = mallResult.rows[0];

    const totalCredits = Number(mall.total_credits);

    // --------------------------------------------------
    // 4. Check sufficient credits
    // --------------------------------------------------
    if (totalCredits < sellingPrice) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Not enough Credits",
        required_credits: sellingPrice,
        available_credits: totalCredits,
      });
    }

    // --------------------------------------------------
    // 5. Create mall product listing
    // --------------------------------------------------
    const insertResult = await client.query(
      `
      INSERT INTO mall_products (
        mall_id,
        product_id,
        selling_price
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        mall_id,
        product_id,
        selling_price,
        created_at
      `,
      [mallId, product_id, sellingPrice]
    );

    // --------------------------------------------------
    // 6. Deduct credits
    // --------------------------------------------------
    const updatedMallResult = await client.query(
      `
      UPDATE malls
      SET
        total_credits = total_credits - $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        total_credits
      `,
      [sellingPrice, mallId]
    );

    // --------------------------------------------------
    // 7. Commit transaction
    // --------------------------------------------------
    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Product listed successfully",
      mall_product: insertResult.rows[0],
      remaining_credits: updatedMallResult.rows[0].total_credits,
    });

  } catch (error) {
    await client.query("ROLLBACK");

    // Handles race condition from unique constraint
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Product is already listed in this mall",
      });
    }

    console.error("List product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to list product",
    });

  } finally {
    client.release();
  }
};
const getListedProducts = async (req, res) => {
  try {
    const mallId = req.user.mallId;

    if (!mallId) {
      return res.status(401).json({
        success: false,
        message: "Mall not authenticated",
      });
    }

    const result = await pool.query(
      `
      SELECT
        mp.id AS mall_product_id,
        mp.mall_id,
        mp.created_at AS listed_at,

        -- Product details
        p.id AS product_id,
        p.name,
        p.description,
        p.price,
        p.selling_price,
        p.stock_quantity,
        p.status,
        p.quality_tier,
        p.product_code,
        p.brand_name,
        p.available_sizes,
        p.available_colors,
        p.weight,
        p.dimensions,
        p.specifications,
        p.moq,
        p.moq_price,
        p.created_at AS product_created_at,
        p.updated_at AS product_updated_at,

        -- Manufacturer details
        m.user_id AS manufacturer_user_id,
        m.business_name AS manufacturer_name,
        m.profile_image AS manufacturer_profile_image,

        -- Product images
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'image_url', pi.image_url,
              'is_primary', pi.is_primary,
              'sort_order', pi.sort_order
            )
            ORDER BY pi.sort_order ASC, pi.id ASC
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'::json
        ) AS images

      FROM mall_products mp

      INNER JOIN products p
        ON p.id = mp.product_id

      INNER JOIN manufacturers m
        ON m.user_id = p.user_id

      LEFT JOIN product_images pi
        ON pi.product_id = p.id

      WHERE mp.mall_id = $1

      GROUP BY
        mp.id,
        mp.mall_id,
        mp.created_at,

        p.id,

        m.user_id,
        m.business_name,
        m.profile_image

      ORDER BY mp.created_at DESC
      `,
      [mallId]
    );

    return res.status(200).json({
      success: true,
      products: result.rows,
    });

  } catch (error) {
    console.error("Get listed mall products error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch listed products",
    });
  }
};
const unlistProduct = async (req, res) => {
  try {
    const mallId = req.user.mallId;
    const { product_id } = req.body;

    if (!mallId) {
      return res.status(401).json({
        success: false,
        message: "Mall not authenticated",
      });
    }

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: "product_id is required",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM mall_products
      WHERE mall_id = $1
        AND product_id = $2
      RETURNING id, mall_id, product_id
      `,
      [mallId, product_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product is not listed in this mall",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product unlisted successfully",
      mall_product: result.rows[0],
    });

  } catch (error) {
    console.error("Unlist product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to unlist product",
    });
  }
};
module.exports = {
  login,
  getManufacturerProducts,
  listProduct,
  getListedProducts,
  unlistProduct
};