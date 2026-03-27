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
        if (!apiKey || apiKey === 'your_openweathermap_key_here') {
            console.error("OPENWEATHERMAP_KEY is not configured in .env file");
            return res.status(503).json({ 
                message: "Weather service is not configured. Please add OPENWEATHERMAP_KEY to backend .env file",
                setupGuide: "Get your free API key from https://openweathermap.org/api"
            });
        }

        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error("Weather API Error:", error.message);
        if (error.response?.status === 401) {
            return res.status(503).json({ 
                message: "Invalid OpenWeatherMap API key. Please check your OPENWEATHERMAP_KEY in backend .env",
                setupGuide: "Get your free API key from https://openweathermap.org/api"
            });
        }
        res.status(500).json({ message: "Failed to fetch weather data: " + error.message });
    }
});

module.exports = router;
