const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

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
      { expiresIn: "1h" }
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
  const { name, description, parentId, sortOrder, commission } = req.body;



  if (!name || !sortOrder || commission == null) {
    return res.status(400).json({ message: "Name, sort_order, and commission are required" });
  }

  try {
   const result = await pool.query(
  `INSERT INTO categories
   (name, description, parent_id, sort_order, commission,is_active)
   VALUES ($1, $2, $3, $4, $5,true)
   RETURNING *`,
  [name, description || null, parentId || null, sortOrder, commission]
);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create category" });
  }
};

// PUT /categories/:id
const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description, parent_id, sortOrder, commission } = req.body;


  try {
   const result = await pool.query(
  `UPDATE categories
   SET name=$1, description=$2, parent_id=$3, sort_order=$4, commission=$5, updated_at=NOW()
   WHERE id=$6
   RETURNING *`,
  [name, description || null, parent_id || null, sortOrder, commission, id]
);


    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update category" });
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

module.exports = {
  loginSuperadmin,
  getCategories,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
};
