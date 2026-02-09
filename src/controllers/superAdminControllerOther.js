const pool = require("../config/db");

module.exports = {
  
  // -------------------------------------
  // GET ALL PACKAGES
  // -------------------------------------
  getAllPackages: async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM packages ORDER BY id DESC"
      );
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching packages:", error);
      return res.status(500).json({ message: "Server error" });
    }
  },

  // -------------------------------------
  // GET SINGLE PACKAGE
  // -------------------------------------
  getPackageById: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        "SELECT * FROM packages WHERE id = $1",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Package not found" });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Error fetching package:", error);
      return res.status(500).json({ message: "Server error" });
    }
  },

  // -------------------------------------
  // CREATE PACKAGE
  // -------------------------------------
  createPackage: async (req, res) => {
    try {
      const { name, offer, price, discount } = req.body;

      const result = await pool.query(
        `INSERT INTO packages (name, offer, price, discount)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, offer, price, discount]
      );

      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Error creating package:", error);
      return res.status(500).json({ message: "Server error" });
    }
  },

  // -------------------------------------
  // UPDATE PACKAGE
  // -------------------------------------
  updatePackage: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, offer, price, discount } = req.body;

      const result = await pool.query(
        `UPDATE packages
         SET name = $1,
             offer = $2,
             price = $3,
             discount = $4,
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [name, offer, price, discount, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Package not found" });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating package:", error);
      return res.status(500).json({ message: "Server error" });
    }
  },

  // -------------------------------------
  // DELETE PACKAGE
  // -------------------------------------
  deletePackage: async (req, res) => {
    try {
      const { id } = req.params;

      await pool.query("DELETE FROM packages WHERE id = $1", [id]);

      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting package:", error);
      return res.status(500).json({ message: "Server error" });
    }
  },
getAllCreators: async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM creators ORDER BY id DESC"
      );
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching creators:", error);
      return res.status(500).json({ message: "Server error" });
    }
  },

  // -------------------------------------
  // GET SINGLE CREATOR
  // -------------------------------------
  getCreatorById: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        "SELECT * FROM creators WHERE id = $1",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Creator not found" });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Error fetching creator:", error);
      return res.status(500).json({ message: "Server error" });
    }
  },

  // -------------------------------------
  // CREATE CREATOR
  // -------------------------------------
  createCreator: async (req, res) => {
    try {
      const { name, number, description, price } = req.body;
  const video_url = req.file ? `/uploads/${req.file.filename}` : null;
    
      const result = await pool.query(
        `INSERT INTO creators (name, number, description, price, video_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, number, description, price, video_url]
      );

      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Error creating creator:", error);
      return res.status(500).json({ message: "Server error" });
    }
  },

  // -------------------------------------
  // UPDATE CREATOR
  // -------------------------------------
 updateCreator: async (req, res) => {
 try {
    const { id } = req.params; // influencer ID
    const { title, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Video file is required" });
    }

    const video_url = `/uploads/${req.file.filename}`;

    const result = await pool.query(
      `INSERT INTO influencer_videos (influencer_id, video_url, title, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, video_url, title, description]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error creating video:", error);
    return res.status(500).json({ message: "Server error" });
  }
},

  // -------------------------------------
  // DELETE CREATOR
  // -------------------------------------
  deleteCreator: async (req, res) => {
    try {
      const { id } = req.params;

      await pool.query("DELETE FROM creators WHERE id = $1", [id]);

      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting creator:", error);
      return res.status(500).json({ message: "Server error" });
    }
  },
};


