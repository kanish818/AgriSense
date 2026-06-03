const express = require("express");
const axios = require("axios");
const router = express.Router();

function mapWeatherCodeToDescription(code) {
    const codeMap = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail"
    };

    return codeMap[code] || "Weather unavailable";
}

async function fetchOpenMeteoWeather(lat, lon) {
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`;
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`;

    const [forecastResponse, geoResponse] = await Promise.all([
        axios.get(forecastUrl, { timeout: 10000 }),
        axios.get(geoUrl, { timeout: 10000 }).catch(() => ({ data: null }))
    ]);

    const forecast = forecastResponse.data;
    const place = geoResponse.data?.results?.[0];
    const placeName = place?.name
        ? [place.name, place.admin1, place.country].filter(Boolean).join(", ")
        : `Lat ${Number(lat).toFixed(2)}, Lon ${Number(lon).toFixed(2)}`;

    return {
        main: {
            temp: forecast.current.temperature_2m,
            humidity: forecast.current.relative_humidity_2m,
            feels_like: forecast.current.apparent_temperature,
            temp_min: forecast.daily.temperature_2m_min?.[0],
            temp_max: forecast.daily.temperature_2m_max?.[0]
        },
        weather: [
            {
                description: mapWeatherCodeToDescription(forecast.current.weather_code)
            }
        ],
        name: placeName,
        wind: {
            speed: Number(forecast.current.wind_speed_10m) / 3.6
        },
        source: "open-meteo"
    };
}

router.get("/", async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ message: "Latitude and Longitude required" });
        }

        const apiKey = process.env.WEATHERAPI_KEY;
        if (!apiKey) {
            const fallbackData = await fetchOpenMeteoWeather(lat, lon);
            return res.json(fallbackData);
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
            },
            source: "weatherapi"
        };

        res.json(transformedData);
    } catch (error) {
        console.error("Weather API Error:", error.message);
        if (error.response?.status === 401 || error.response?.status === 403) {
            try {
                const fallbackData = await fetchOpenMeteoWeather(req.query.lat, req.query.lon);
                return res.json(fallbackData);
            } catch (fallbackError) {
                console.error("Open-Meteo fallback failed:", fallbackError.message);
            }
        }
        res.status(500).json({ message: "Failed to fetch weather data: " + error.message });
    }
});

module.exports = router;
