const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8080;

// Allow CORS and JSON data
app.use(cors());
app.use(express.json());

// Temporary in-memory storage
let sensorData = [];

// Default route
app.get('/', (req, res) => {
  res.send('🚀 ESP32 Multi-Sensor API is running and ready for data!');
});

// POST route - ESP32 sends data here
app.post('/data', (req, res) => {
  const data = req.body;
  
  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'No sensor data received' });
  }

  // Add timestamp for tracking
  data.timestamp = new Date().toISOString();

  // Save data in memory (for now)
  sensorData.push(data);

  console.log('📡 Received data:', data);

  res.status(200).json({
    message: 'Data received successfully',
    received: data
  });
});

// GET route - frontend or you can view data
app.get('/data', (req, res) => {
  res.json(sensorData);
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
