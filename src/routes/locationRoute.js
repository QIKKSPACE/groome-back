const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// ==========================================
// 1. POST: Bulk Add Locations (Array Input)
// ==========================================
router.post("/bulk-add", async (req, res) => {
  const { level, parentId, values } = req.body;

  if (!level || !Array.isArray(values) || values.length === 0) {
    return res.status(400).json({ error: "Level and an array of values are required." });
  }

  try {
    let query = "";
    let params = [];

    switch (level.toLowerCase()) {
      case "country":
        query = `
          INSERT INTO countries (name)
          SELECT unnest($1::text[])
          ON CONFLICT (name) DO NOTHING
          RETURNING *;
        `;
        params = [values];
        break;

      case "state":
        if (!parentId) return res.status(400).json({ error: "parentId (country_id) is required for states." });
        query = `
          INSERT INTO states (country_id, name)
          SELECT $1, unnest($2::text[])
          ON CONFLICT (country_id, name) DO NOTHING
          RETURNING *;
        `;
        params = [parentId, values];
        break;

      case "city":
        if (!parentId) return res.status(400).json({ error: "parentId (state_id) is required for cities." });
        query = `
          INSERT INTO cities (state_id, name)
          SELECT $1, unnest($2::text[])
          ON CONFLICT (state_id, name) DO NOTHING
          RETURNING *;
        `;
        params = [parentId, values];
        break;

      case "tehsil":
        if (!parentId) return res.status(400).json({ error: "parentId (city_id) is required for tehsils." });
        query = `
          INSERT INTO tehsils (city_id, name)
          SELECT $1, unnest($2::text[])
          ON CONFLICT (city_id, name) DO NOTHING
          RETURNING *;
        `;
        params = [parentId, values];
        break;

      case "pincode":
        if (!parentId) return res.status(400).json({ error: "parentId (tehsil_id) is required for pincodes." });
        query = `
          INSERT INTO pincodes (tehsil_id, pincode)
          SELECT $1, unnest($2::text[])
          ON CONFLICT (tehsil_id, pincode) DO NOTHING
          RETURNING *;
        `;
        params = [parentId, values];
        break;

      default:
        return res.status(400).json({ error: "Invalid location level provided." });
    }

    const result = await pool.query(query, params);
    return res.status(201).json({
      success: true,
      message: `Successfully processed ${values.length} ${level}(s).`,
      inserted: result.rows,
    });
  } catch (error) {
    console.error("Error bulk adding locations:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. GET: Return Complete Location Hierarchy
// ==========================================
router.get("/all", async (req, res) => {
  try {
    const query = `
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', co.id,
            'name', co.name,
            'code', co.code,
            'states', (
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'id', st.id,
                    'name', st.name,
                    'cities', (
                      SELECT COALESCE(
                        json_agg(
                          json_build_object(
                            'id', ct.id,
                            'name', ct.name,
                            'tehsils', (
                              SELECT COALESCE(
                                json_agg(
                                  json_build_object(
                                    'id', th.id,
                                    'name', th.name,
                                    'pincodes', (
                                      SELECT COALESCE(
                                        json_agg(
                                          json_build_object(
                                            'id', pc.id,
                                            'code', pc.pincode
                                          )
                                        ), '[]'::json
                                      )
                                      FROM pincodes pc WHERE pc.tehsil_id = th.id
                                    )
                                  )
                                ), '[]'::json
                              )
                              FROM tehsils th WHERE th.city_id = ct.id
                            )
                          )
                        ), '[]'::json
                      )
                      FROM cities ct WHERE ct.state_id = st.id
                    )
                  )
                ), '[]'::json
              )
              FROM states st WHERE st.country_id = co.id
            )
          )
        ), '[]'::json
      ) AS locations
      FROM countries co;
    `;

    const result = await pool.query(query);
    return res.json(result.rows[0].locations);
  } catch (error) {
    console.error("Error fetching full location hierarchy:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. GET: Fetch Child Locations for Dropdowns
// ==========================================
router.get("/dropdowns", async (req, res) => {
  const { level, parentId } = req.query;

  try {
    let query = "";
    let params = [];

    if (level === "country") {
      query = "SELECT id, name, code FROM countries ORDER BY name ASC;";
    } else if (level === "state" && parentId) {
      query = "SELECT id, name FROM states WHERE country_id = $1 ORDER BY name ASC;";
      params = [parentId];
    } else if (level === "city" && parentId) {
      query = "SELECT id, name FROM cities WHERE state_id = $1 ORDER BY name ASC;";
      params = [parentId];
    } else if (level === "tehsil" && parentId) {
      query = "SELECT id, name FROM tehsils WHERE city_id = $1 ORDER BY name ASC;";
      params = [parentId];
    } else if (level === "pincode" && parentId) {
      query = "SELECT id, pincode AS code FROM pincodes WHERE tehsil_id = $1 ORDER BY pincode ASC;";
      params = [parentId];
    } else {
      return res.status(400).json({ error: "Invalid level or missing parentId query parameter." });
    }

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (error) {
    console.error("Error fetching dropdown items:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. DELETE: Delete Location Entry by Level & ID
// ==========================================
router.delete("/:level/:id", async (req, res) => {
  const { level, id } = req.params;

  if (!level || !id) {
    return res.status(400).json({ error: "Both level and ID are required parameters." });
  }

  // Allowed table mapping to protect against SQL injection
  const tableMap = {
    country: "countries",
    state: "states",
    city: "cities",
    tehsil: "tehsils",
    pincode: "pincodes"
  };

  const tableName = tableMap[level.toLowerCase()];

  if (!tableName) {
    return res.status(400).json({ error: "Invalid location level specified." });
  }

  try {
    const query = `DELETE FROM ${tableName} WHERE id = $1 RETURNING *;`;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `${level} with ID ${id} not found.` });
    }

    return res.json({
      success: true,
      message: `Successfully deleted ${level} (ID: ${id}) and all its associated child entries.`,
      deleted: result.rows[0],
    });
  } catch (error) {
    console.error(`Error deleting ${level}:`, error);
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. PUT: Edit/Update Location Entry by Level & ID
// ==========================================
router.put("/:level/:id", async (req, res) => {
  const { level, id } = req.params;
  const { name, code } = req.body; // 'code' applies to pincode or country code updates

  if (!level || !id) {
    return res.status(400).json({ error: "Both level and ID are required parameters." });
  }

  // Value check based on entity level
  const updateValue = level.toLowerCase() === "pincode" ? code : name;
  if (!updateValue) {
    return res.status(400).json({
      error: level.toLowerCase() === "pincode" 
        ? "Property 'code' (pincode value) is required." 
        : "Property 'name' is required."
    });
  }

  try {
    let query = "";
    let params = [];

    switch (level.toLowerCase()) {
      case "country":
        query = `
          UPDATE countries 
          SET name = $1, code = COALESCE($2, code) 
          WHERE id = $3 
          RETURNING *;
        `;
        params = [name, code || null, id];
        break;

      case "state":
        query = `
          UPDATE states 
          SET name = $1 
          WHERE id = $2 
          RETURNING *;
        `;
        params = [name, id];
        break;

      case "city":
        query = `
          UPDATE cities 
          SET name = $1 
          WHERE id = $2 
          RETURNING *;
        `;
        params = [name, id];
        break;

      case "tehsil":
        query = `
          UPDATE tehsils 
          SET name = $1 
          WHERE id = $2 
          RETURNING *;
        `;
        params = [name, id];
        break;

      case "pincode":
        query = `
          UPDATE pincodes 
          SET pincode = $1 
          WHERE id = $2 
          RETURNING *;
        `;
        params = [code, id];
        break;

      default:
        return res.status(400).json({ error: "Invalid location level specified." });
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `${level} with ID ${id} not found.` });
    }

    return res.json({
      success: true,
      message: `Successfully updated ${level} (ID: ${id}).`,
      updated: result.rows[0],
    });
  } catch (error) {
    console.error(`Error updating ${level}:`, error);

    // Handle unique constraint violation (e.g., duplicate names under the same parent)
    if (error.code === "23505") {
      return res.status(409).json({ error: `A ${level} with this name or code already exists in this scope.` });
    }

    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;