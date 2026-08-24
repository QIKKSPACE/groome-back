const pool = require("../config/db");

const fs = require("fs");
const path = require("path");

async function getProducts(req, res) {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `
      SELECT
        p.*,
        c.name AS category_name,
        sc.name AS sub_category_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'image_url', pi.image_url,
              'is_primary', pi.is_primary
            )
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN categories c
        ON p.category_id = c.id
      LEFT JOIN categories sc
        ON p.sub_category_id = sc.id
      LEFT JOIN product_images pi
        ON p.id = pi.product_id
      WHERE p.user_id = $1
      GROUP BY p.id, c.name, sc.name
      ORDER BY p.created_at DESC
      `,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
}
async function createProduct(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userId = req.user.userId;

    const {
      name,
      description,
      mrp,
      selling_price,
      stockQuantity,
      mall_id,
      category_id,
      sub_category_id,
      quality_tier,
       product_code,
    } = req.body;

    const uploadedFiles = req.files || [];

    const productResult = await client.query(
  `
  INSERT INTO products (
    user_id,
    mall_id,
    category_id,
    sub_category_id,
    product_code,
    name,
    description,
    price,
    selling_price,
    stock_quantity,
    quality_tier
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  RETURNING *
  `,
  [
    userId,
    mall_id || null,
    category_id || null,
    sub_category_id || null,
    product_code || null,
    name,
    description,
    mrp || 0,
    selling_price || 0,
    stockQuantity || 0,
    quality_tier || "Budget Quality",
  ]
);

    const product = productResult.rows[0];

    // Save uploaded images
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];

      await client.query(
        `
        INSERT INTO product_images (
          product_id,
          image_url,
          is_primary,
          sort_order
        )
        VALUES ($1,$2,$3,$4)
        `,
        [
          product.id,
          `/uploads/${file.filename}`,
          i === 0,
          i,
        ]
      );
    }

    await client.query("COMMIT");

    const completeProduct = await client.query(
      `
      SELECT
        p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'image_url', pi.image_url,
              'is_primary', pi.is_primary
            )
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi
        ON p.id = pi.product_id
      WHERE p.id = $1
      GROUP BY p.id
      `,
      [product.id]
    );

    res.status(201).json(completeProduct.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create Product Error:", err);

    res.status(500).json({
      message: "Failed to create product",
    });
  } finally {
    client.release();
  }
}


async function deleteProduct(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userId = req.user.userId;
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


async function updateProduct(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userId = req.user.userId;
    const { id } = req.params;

    const {
      name,
      description,
      mrp,
      selling_price,
      stockQuantity,
      mall_id,
      category_id,
      sub_category_id,
    } = req.body;

    // Existing images user wants to keep
 const existingImages = req.body.existingImages
  ? JSON.parse(req.body.existingImages)
  : [];
    const result = await client.query(
      `
      UPDATE products
      SET
        name = $1,
        description = $2,
        price = $3,
        selling_price = $4,
        stock_quantity = $5,
        mall_id = $6,
        category_id = $7,
        sub_category_id = $8,
     
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      AND user_id = $10
      RETURNING *
      `,
      [
        name,
        description,
        mrp,
        selling_price,
        stockQuantity,
        mall_id,
        category_id,
        sub_category_id,
     
        id,
        userId,
      ]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Product not found",
      });
    }

    // Current images in DB
    const oldImagesResult = await client.query(
      `
      SELECT id, image_url
      FROM product_images
      WHERE product_id = $1
      `,
      [id]
    );

    const oldImages = oldImagesResult.rows;

    // Images removed by user
    const imagesToDelete = oldImages.filter(
      (img) => !existingImages.includes(img.image_url)
    );

    // Delete removed files + DB rows
    for (const img of imagesToDelete) {
      const filePath = path.join(
        __dirname,
        "..",
        img.image_url.replace(/^\/+/, "")
      );

      fs.unlink(filePath, (err) => {
        if (err) {
          console.log("Could not delete file:", filePath);
        }
      });

      await client.query(
        `DELETE FROM product_images WHERE id = $1`,
        [img.id]
      );
    }

    // Add newly uploaded files
    if (req.files?.length) {
      let sortOrder = oldImages.length;

      for (const file of req.files) {
        const imageUrl = `/uploads/${file.filename}`;

        await client.query(
          `
          INSERT INTO product_images (
            product_id,
            image_url,
            is_primary,
            sort_order
          )
          VALUES ($1,$2,$3,$4)
          `,
          [
            id,
            imageUrl,
            false,
            sortOrder++,
          ]
        );
      }
    }

    await client.query("COMMIT");

    const updatedProduct = await client.query(
      `
      SELECT
        p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'image_url', pi.image_url
            )
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) as images
      FROM products p
      LEFT JOIN product_images pi
        ON pi.product_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
      `,
      [id]
    );

    return res.json(updatedProduct.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);

    return res.status(500).json({
      message: "Failed to update product",
    });
  } finally {
    client.release();
  }
}
module.exports = {
  deleteProduct,
  createProduct,
  getProducts,
  updateProduct,


};