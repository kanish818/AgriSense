const express = require("express");
const axios = require("axios");
const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ message: "Latitude and Longitude required" });
        }

        const apiKey = process.env.OPENWEATHERMAP_KEY;
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error("Weather API Error:", error.message);
        res.status(500).json({ message: "Failed to fetch weather data" });
    }
});

module.exports = router;
