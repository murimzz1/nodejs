const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON data
app.use(express.json());

// Default route
app.get("/", (req, res) => {
  res.send("ESP32 Multi-Sensor API is running 🚀");
});

// Route for receiving data from ESP32
app.post("/api/data", (req, res) => {
  const {
    temperature1,
    temperature2,
    co2,
    pressure,
    humidity,
    energyMeter
  } = req.body;

  console.log("📡 Data received from ESP32:");
  console.log("🌡️ Temperature Sensor 1:", temperature1);
  console.log("🌡️ Temperature Sensor 2:", temperature2);
  console.log("💨 CO₂ Sensor:", co2);
  console.log("🧭 Pressure Sensor:", pressure);
  console.log("💧 Humidity Sensor:", humidity);
  console.log("⚡ Energy Meter:", energyMeter);

  res.json({ message: "Data received successfully!" });
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
