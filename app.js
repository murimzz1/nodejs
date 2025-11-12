const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Temporary in-memory data storage
let sensorData = [];

// Default route
app.get('/', (req, res) => {
  res.send('🚀 ESP32 Multi-Sensor API is running and ready for data!');
});

// ✅ POST route for ESP32 to send data
app.post('/data', (req, res) => {
  const data = req.body;
  
  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'No sensor data received' });
  }

  // Add timestamp for record-keeping
  data.timestamp = new Date().toISOString();
  sensorData.push(data);

  console.log('📡 Received data:', data);
  res.status(200).json({
    message: 'Data received successfully',
    received: data
  });
});

// ✅ GET route to view data
app.get('/data', (req, res) => {
  res.json(sensorData);
});

// Start the server
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
