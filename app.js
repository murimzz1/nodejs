const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Root route to verify the API is live
app.get("/", (req, res) => {
  res.send("🚀 ESP32 Multi-Sensor API is running!");
});

// Example route to receive ESP32 data
app.post("/api/sensor", (req, res) => {
  console.log("Received data:", req.body);
  res.json({ status: "success", received: req.body });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

