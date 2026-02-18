const express = require("express");
require("dotenv").config();
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const Groq = require("groq-sdk");
const mongoose = require("mongoose");
const { verifyToken } = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const weatherRoutes = require("./routes/weather");
const schemesRoutes = require("./routes/schemes");

const app = express();
app.use(cors());
app.use(express.json());

// Public routes
app.use("/api/auth", authRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/schemes", schemesRoutes);

// Protected routes
app.use("/api/chat", verifyToken, chatRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Connection Error:", err.message));

// Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// POST /api/analyze-soil (Protected)
app.post("/api/analyze-soil", verifyToken, upload.single("soilImage"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });

    const base64Image = fs.readFileSync(req.file.path).toString("base64");

    const chatCompletion = await groq.chat.completions.create({
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Analyze this soil image. Identify the soil type (clay, sandy, loamy, etc.) and suggest 3-5 suitable crops for this soil type in India. Also mention any soil health observations. Format with clear headings." },
          { type: "image_url", image_url: { url: `data:${req.file.mimetype};base64,${base64Image}` } }
        ]
      }],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.5,
      max_tokens: 1024,
    });

    res.json({ crops: chatCompletion.choices[0]?.message?.content || "Could not analyze." });
  } catch (error) {
    console.error("Soil Analysis Error:", error.message);
    res.status(500).json({ message: "Failed to analyze soil: " + error.message });
  }
});

// POST /api/analyze-plant (Protected)
app.post("/api/analyze-plant", verifyToken, upload.single("plantImage"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });

    const base64Image = fs.readFileSync(req.file.path).toString("base64");

    const chatCompletion = await groq.chat.completions.create({
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Look at this plant image carefully. Identify if the plant has any disease, pest damage, or nutrient deficiency. If healthy, say so. If there is an issue, provide: 1) Disease/problem name, 2) Cause, 3) Recommended treatment. Be practical for Indian farmers." },
          { type: "image_url", image_url: { url: `data:${req.file.mimetype};base64,${base64Image}` } }
        ]
      }],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.5,
      max_tokens: 1024,
    });

    res.json({ health: chatCompletion.choices[0]?.message?.content || "Could not analyze." });
  } catch (error) {
    console.error("Plant Analysis Error:", error.message);
    res.status(500).json({ message: "Failed to analyze plant: " + error.message });
  }
});

// POST /api/crop-advice (Protected)
app.post("/api/crop-advice", verifyToken, async (req, res) => {
  try {
    const { location, season, soilType, language } = req.body;
    const lang = language === "hindi" ? "Hindi" : language === "punjabi" ? "Punjabi" : "English";

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: `You are an expert Indian agricultural advisor. Respond in ${lang}. Based on: Location: ${location || "Central India"}, Season: ${season || "Kharif"}, Soil Type: ${soilType || "Not specified"}. Suggest top 5 crops with expected yield, cost, market price, and key tips.` }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1500,
    });

    res.json({ advice: chatCompletion.choices[0]?.message?.content || "Could not generate." });
  } catch (error) {
    console.error("Crop Advice Error:", error.message);
    res.status(500).json({ message: "Failed to get crop advice" });
  }
});

// POST /api/financial-guidance (Protected)
app.post("/api/financial-guidance", verifyToken, async (req, res) => {
  try {
    const { topic, language } = req.body;
    const lang = language === "hindi" ? "Hindi" : language === "punjabi" ? "Punjabi" : "English";

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: `You are a financial advisor for Indian agriculture. Respond in ${lang}. Topic: ${topic || "general financial planning"}. Cover: government schemes, loan options, insurance, cost-saving tips, and revenue strategies. Be specific with scheme names and eligibility.` }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1500,
    });

    res.json({ guidance: chatCompletion.choices[0]?.message?.content || "Could not generate." });
  } catch (error) {
    console.error("Financial Guidance Error:", error.message);
    res.status(500).json({ message: "Failed to get financial guidance" });
  }
});

// POST /api/location-schemes (Protected) — AI-powered location-based scheme recommendations
app.post("/api/location-schemes", verifyToken, async (req, res) => {
  try {
    const { location, language } = req.body;
    const lang = language === "hindi" ? "Hindi" : language === "punjabi" ? "Punjabi" : "English";

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: `List the top 10 most popular and beneficial Indian government agricultural schemes available for farmers in ${location || "India"} in 2024-2025. Respond in ${lang}. For each scheme provide: 1) Scheme Name, 2) Brief description, 3) Key benefits, 4) How to apply. Focus on schemes most relevant to that region.` }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 2000,
    });

    res.json({ schemes: chatCompletion.choices[0]?.message?.content || "Could not get schemes." });
  } catch (error) {
    console.error("Location Schemes Error:", error.message);
    res.status(500).json({ message: "Failed to get schemes" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
