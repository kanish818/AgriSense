const express = require("express");
const axios = require("axios");
const router = express.Router();

function formatLatLonName(lat, lon) {
    return `Lat ${Number(lat).toFixed(2)}, Lon ${Number(lon).toFixed(2)}`;
}

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

function mapTomorrowWeatherCodeToDescription(code) {
    const codeMap = {
        1000: "Clear",
        1001: "Cloudy",
        1100: "Mostly clear",
        1101: "Partly cloudy",
        1102: "Mostly cloudy",
        2000: "Fog",
        2100: "Light fog",
        4000: "Drizzle",
        4001: "Rain",
        4200: "Light rain",
        4201: "Heavy rain",
        5000: "Snow",
        5001: "Flurries",
        5100: "Light snow",
        5101: "Heavy snow",
        6000: "Freezing drizzle",
        6001: "Freezing rain",
        6200: "Light freezing rain",
        6201: "Heavy freezing rain",
        7000: "Ice pellets",
        7101: "Heavy ice pellets",
        7102: "Light ice pellets",
        8000: "Thunderstorm"
    };

    return codeMap[code] || "Weather unavailable";
}

function formatMetNoDescription(symbolCode) {
    if (!symbolCode) return "Weather unavailable";
    return symbolCode
        .replace(/_/g, " ")
        .replace(/\b(day|night)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
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
        : formatLatLonName(lat, lon);

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

async function fetchMetNoWeather(lat, lon) {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
    const response = await axios.get(url, {
        timeout: 10000,
        headers: {
            "User-Agent": "AgriSense/1.0"
        }
    });

    const timeseries = response.data?.properties?.timeseries || [];
    const current = timeseries[0];
    const details = current?.data?.instant?.details;

    if (!details) {
        throw new Error("met.no response missing weather fields");
    }

    const tempSeries = timeseries
        .slice(0, 24)
        .map((entry) => Number(entry?.data?.instant?.details?.air_temperature))
        .filter((value) => Number.isFinite(value));

    return {
        main: {
            temp: Number(details.air_temperature),
            humidity: Number(details.relative_humidity),
            feels_like: Number(details.air_temperature),
            temp_min: tempSeries.length ? Math.min(...tempSeries) : Number(details.air_temperature),
            temp_max: tempSeries.length ? Math.max(...tempSeries) : Number(details.air_temperature)
        },
        weather: [
            {
                description: formatMetNoDescription(
                    current?.data?.next_1_hours?.summary?.symbol_code ||
                    current?.data?.next_6_hours?.summary?.symbol_code ||
                    current?.data?.next_12_hours?.summary?.symbol_code
                )
            }
        ],
        name: formatLatLonName(lat, lon),
        wind: {
            speed: Number(details.wind_speed)
        },
        source: "met-no"
    };
}

async function fetchWttrWeather(lat, lon) {
    const url = `https://wttr.in/${lat},${lon}?format=j1`;
    const response = await axios.get(url, {
        timeout: 10000,
        headers: {
            "User-Agent": "AgriSense/1.0"
        }
    });

    const current = response.data?.current_condition?.[0];
    const today = response.data?.weather?.[0];
    const area = response.data?.nearest_area?.[0];

    if (!current || !today) {
        throw new Error("wttr.in response missing weather fields");
    }

    const areaName = area?.areaName?.[0]?.value;
    const region = area?.region?.[0]?.value;
    const country = area?.country?.[0]?.value;

    return {
        main: {
            temp: Number(current.temp_C),
            humidity: Number(current.humidity),
            feels_like: Number(current.FeelsLikeC),
            temp_min: Number(today.mintempC),
            temp_max: Number(today.maxtempC)
        },
        weather: [
            {
                description: current.weatherDesc?.[0]?.value || "Weather unavailable"
            }
        ],
        name: [areaName, region, country].filter(Boolean).join(", ") || formatLatLonName(lat, lon),
        wind: {
            speed: Number(current.windspeedKmph) / 3.6
        },
        source: "wttr"
    };
}

async function fetchTomorrowWeather(lat, lon) {
    const apiKey = process.env.TOMORROW_API_KEY;
    if (!apiKey) {
        throw new Error("TOMORROW_API_KEY is not configured");
    }

    const params = {
        location: `${lat},${lon}`,
        units: "metric",
        apikey: apiKey
    };

    const [realtimeResponse, forecastResponse] = await Promise.all([
        axios.get("https://api.tomorrow.io/v4/weather/realtime", {
            params,
            timeout: 10000,
            headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate, br"
            }
        }),
        axios.get("https://api.tomorrow.io/v4/weather/forecast", {
            params: {
                ...params,
                timesteps: "1d"
            },
            timeout: 10000,
            headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate, br"
            }
        })
    ]);

    const current = realtimeResponse.data?.data?.values;
    const today = forecastResponse.data?.timelines?.daily?.[0]?.values;
    const location = realtimeResponse.data?.location || forecastResponse.data?.location;

    if (!current) {
        throw new Error("Tomorrow.io response missing weather fields");
    }

    return {
        main: {
            temp: Number(current.temperature),
            humidity: Number(current.humidity),
            feels_like: Number(current.temperatureApparent ?? current.temperature),
            temp_min: Number(today?.temperatureMin ?? current.temperature),
            temp_max: Number(today?.temperatureMax ?? current.temperature)
        },
        weather: [
            {
                description: mapTomorrowWeatherCodeToDescription(
                    Number(current.weatherCode ?? today?.weatherCodeMax ?? today?.weatherCodeMin)
                )
            }
        ],
        name: location?.name || formatLatLonName(lat, lon),
        wind: {
            speed: Number(current.windSpeed ?? 0)
        },
        source: "tomorrow.io"
    };
}

function transformWeatherApiResponse(data) {
    return {
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
            speed: data.current.wind_kph / 3.6
        },
        source: "weatherapi"
    };
}

async function fetchOpenWeatherMapWeather(lat, lon) {
    const apiKey = process.env.OPENWEATHERMAP_KEY;
    if (!apiKey) {
        throw new Error("OPENWEATHERMAP_KEY is not configured");
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
}

router.get("/", async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ message: "Latitude and Longitude required" });
        }

        try {
            const tomorrowData = await fetchTomorrowWeather(lat, lon);
            return res.json(tomorrowData);
        } catch (tomorrowError) {
            console.error("Tomorrow.io provider error:", tomorrowError.message);
        }

        const weatherApiKey = process.env.WEATHERAPI_KEY;
        if (weatherApiKey) {
            const url = `https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${lat},${lon}&days=1`;
            try {
                const response = await axios.get(url, { timeout: 10000 });
                return res.json(transformWeatherApiResponse(response.data));
            } catch (weatherApiError) {
                console.error("WeatherAPI provider error:", weatherApiError.message);
            }
        }

        try {
            const fallbackData = await fetchOpenWeatherMapWeather(lat, lon);
            return res.json(fallbackData);
        } catch (openWeatherMapError) {
            console.error("OpenWeatherMap provider error:", openWeatherMapError.message);
        }

        try {
            const fallbackData = await fetchOpenMeteoWeather(lat, lon);
            return res.json(fallbackData);
        } catch (openMeteoError) {
            console.error("Open-Meteo provider error:", openMeteoError.message);
        }

        try {
            const fallbackData = await fetchMetNoWeather(lat, lon);
            return res.json(fallbackData);
        } catch (metNoError) {
            console.error("met.no provider error:", metNoError.message);
        }

        try {
            const fallbackData = await fetchWttrWeather(lat, lon);
            return res.json(fallbackData);
        } catch (wttrError) {
            console.error("wttr.in provider error:", wttrError.message);
            throw wttrError;
        }
    } catch (error) {
        console.error("Weather route failed:", error.message);
        res.status(500).json({ message: "Failed to fetch weather data: " + error.message });
    }
});

module.exports = router;
