const express = require("express");
const axios = require("axios");
const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ message: "Latitude and Longitude required" });
        }

        const apiKey = process.env.WEATHERAPI_KEY || '22cfa637441144c5ba8181352262703';
        if (!apiKey) {
            console.error("WEATHERAPI_KEY is not configured");
            return res.status(503).json({ 
                message: "Weather service is not configured. Please add WEATHERAPI_KEY to backend .env file",
                setupGuide: "Get your API key from https://www.weatherapi.com/"
            });
        }

        const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lon}&days=1`;

        const response = await axios.get(url);
        const data = response.data;

        // Transform data to match existing OpenWeatherMap structure for frontend compatibility
        const transformedData = {
            main: {
                temp: data.current.temp_c,
                humidity: data.current.humidity,
                feels_like: data.current.feelslike_c,
                temp_min: data.forecast.forecastday[0].day.mintemp_c,
                temp_max: data.forecast.forecastday[0].day.maxtemp_c
            },
            weather: [
                {
                    description: data.current.condition.text
                }
            ],
            name: data.location.name,
            wind: {
                speed: data.current.wind_kph / 3.6 // Convert kph to m/s
            }
        };

        res.json(transformedData);
    } catch (error) {
        console.error("Weather API Error:", error.message);
        if (error.response?.status === 401 || error.response?.status === 403) {
            return res.status(503).json({ 
                message: "Invalid Weather API key. Please check your WEATHERAPI_KEY",
                setupGuide: "Get your API key from https://www.weatherapi.com/"
            });
        }
        res.status(500).json({ message: "Failed to fetch weather data: " + error.message });
    }
});

module.exports = router;
