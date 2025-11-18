// app.js
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Configure PG connection (Railway)
const connectionString = process.env.DATABASE_URL || null;
const pool = new Pool({
  connectionString,
  ssl: connectionString ? { rejectUnauthorized: false } : false
});

// Initialize DB
(async () => {
  if (!connectionString) {
    console.warn("⚠️ No DATABASE_URL found. Running in memory mode.");
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sensor_readings (
        id SERIAL PRIMARY KEY,
        device_id TEXT,
        payload JSONB,
        timestamp_utc TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("✅ sensor_readings table ready.");
  } catch (err) {
    console.error("❌ DB init error:", err);
  }
})();

// In-memory fallback
let memoryStore = [];

// Root
app.get("/", (req, res) => {
  res.send("🚀 ESP32 Multi-Sensor API running!");
});

// Convert UTC → EAT (Nairobi) and format
function formatToEAT(dateObj) {
  const eatDate = new Date(
    dateObj.toLocaleString("en-US", { timeZone: "Africa/Nairobi" })
  );

  // Format: YYYY-MM-DD HH:MM:SS
  const pad = (n) => (n < 10 ? "0" + n : n);

  return (
    eatDate.getFullYear() +
    "-" +
    pad(eatDate.getMonth() + 1) +
    "-" +
    pad(eatDate.getDate()) +
    " " +
    pad(eatDate.getHours()) +
    ":" +
    pad(eatDate.getMinutes()) +
    ":" +
    pad(eatDate.getSeconds())
  );
}

// ===========================
//   POST /data
// ===========================
app.post("/data", async (req, res) => {
  let data = req.body;

  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ message: "No sensor data received" });
  }

  // Extract device_id but remove it from payload
  const deviceId = data.deviceId || data.device_id || null;
  delete data.deviceId;
  delete data.device_id;

  // Add server timestamp
  const now = new Date();
  data.server_timestamp = now.toISOString();

  if (connectionString) {
    try {
      const q = `
        INSERT INTO sensor_readings (device_id, payload)
        VALUES ($1, $2)
        RETURNING id, timestamp_utc
      `;
      const result = await pool.query(q, [deviceId, data]);
      const inserted = result.rows[0];

      // Format timestamp to EAT only
      const formattedEAT = formatToEAT(inserted.timestamp_utc);

      return res.status(201).json({
        message: "Data stored successfully",
        id: inserted.id,
        timestamp: formattedEAT,   // EAT only
        received: data
      });
    } catch (err) {
      console.error("DB insert error:", err);
      return res.status(500).json({ message: "Database error", error: err.message });
    }
  }

  // Memory fallback
  memoryStore.push(data);
  return res.status(200).json({
    message: "Data received (memory mode)",
    received: data
  });
});

// ===========================
//   GET /data (filters + pagination)
// ===========================
app.get("/data", async (req, res) => {
  try {
    let { minutes, hours, days, from, to, page, pageSize } = req.query;

    page = page ? parseInt(page) : 1;
    pageSize = pageSize ? parseInt(pageSize) : 50;

    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    let whereClauses = [];
    let values = [];
    let idx = 1;

    if (minutes) whereClauses.push(`timestamp_utc >= NOW() - INTERVAL '${parseInt(minutes)} minutes'`);
    if (hours) whereClauses.push(`timestamp_utc >= NOW() - INTERVAL '${parseInt(hours)} hours'`);
    if (days) whereClauses.push(`timestamp_utc >= NOW() - INTERVAL '${parseInt(days)} days'`);

    if (from) {
      whereClauses.push(`timestamp_utc >= $${idx++}`);
      values.push(new Date(from));
    }
    if (to) {
      whereClauses.push(`timestamp_utc <= $${idx++}`);
      values.push(new Date(to));
    }

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Query + pagination
    const q = `
      SELECT id, device_id, payload, timestamp_utc
      FROM sensor_readings
      ${whereSQL}
      ORDER BY timestamp_utc DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    const qCount = `
      SELECT COUNT(*) AS total
      FROM sensor_readings
      ${whereSQL};
    `;

    const [result, countResult] = await Promise.all([
      pool.query(q, values),
      pool.query(qCount, values)
    ]);

    const totalRows = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalRows / pageSize);

    // Convert all timestamps to EAT only
    const formatted = result.rows.map(row => ({
      id: row.id,
      device_id: row.device_id,
      payload: row.payload,
      timestamp: formatToEAT(row.timestamp_utc)   // clean EAT only
    }));

    return res.json({
      pagination: {
        page,
        pageSize,
        totalRows,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      data: formatted
    });

  } catch (err) {
    console.error("DB select error:", err);
    return res.status(500).json({ message: "Database error", error: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
