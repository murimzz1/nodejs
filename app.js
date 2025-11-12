// app.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Configure PG pool using Railway DATABASE_URL environment variable
// Railway provides DATABASE_URL (Postgres). For many managed providers we need SSL.
const connectionString = process.env.DATABASE_URL || null;
const pool = new Pool({
  connectionString: connectionString,
  // If using Railway/Postgres with SSL required, allow this:
  ssl: connectionString ? { rejectUnauthorized: false } : false
});

// Initialize DB table (idempotent)
(async () => {
  if (!connectionString) {
    console.warn('⚠️  No DATABASE_URL found. The app will run in memory only.');
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
    console.log('✅ sensor_readings table ready.');
  } catch (err) {
    console.error('❌ Failed to create table:', err);
  }
})();

// In-memory fallback storage when no DB is configured
let memoryStore = [];

// Root - sanity
app.get('/', (req, res) => {
  res.send('🚀 ESP32 Multi-Sensor API is running and ready for data!');
});

// POST route - ESP32 sends data here
app.post('/data', async (req, res) => {
  const data = req.body;
  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'No sensor data received' });
  }

  // Add a timestamp server-side
  data.server_timestamp = new Date().toISOString();

  // If DB is available, insert; otherwise keep in-memory
  if (connectionString) {
    try {
      const deviceId = data.deviceId || data.device_id || null;
      const q = 'INSERT INTO sensor_readings (device_id, payload) VALUES ($1, $2) RETURNING id, timestamp_utc';
      const values = [deviceId, data];
      const result = await pool.query(q, values);
      const inserted = result.rows[0];
      console.log('📡 Saved to DB id=', inserted.id);
      return res.status(201).json({
        message: 'Data received and stored in DB',
        id: inserted.id,
        timestamp_utc: inserted.timestamp_utc,
        received: data
      });
    } catch (err) {
      console.error('DB insert error:', err);
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
  } else {
    // fallback memory
    memoryStore.push(data);
    console.log('📡 Saved to memoryStore:', data);
    return res.status(200).json({ message: 'Data received (memory)', received: data });
  }
});

// GET route - fetch recent data (DB or in-memory)
app.get('/data', async (req, res) => {
  if (connectionString) {
    try {
      const q = 'SELECT id, device_id, payload, timestamp_utc FROM sensor_readings ORDER BY timestamp_utc DESC LIMIT 200';
      const result = await pool.query(q);
      return res.json(result.rows);
    } catch (err) {
      console.error('DB select error:', err);
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
  } else {
    return res.json(memoryStore);
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
