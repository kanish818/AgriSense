const { spawn } = require("child_process");
const Farmer = require("../models/Farmer");


exports.registerFarmer = async (req, res) => {
  try {
    const { name, phone, language, location, crops } = req.body;

    // Check if farmer already exists
    let farmer = await Farmer.findOne({ phone });

    if (farmer) {
      return res.status(200).json({ message: "Welcome back!", farmer_id: farmer._id, language: farmer.language });
    }
    // Create new farmer
    farmer = await Farmer.create({
      name,
      phone,
      language: language || "en",
      location: location || "",
      crops: crops || []
    });

    res.status(201).json({ message: "Registration successful", farmer_id: farmer._id, language: farmer.language });
  } catch (error) {
    console.error("Error registering farmer:", error);
    res.status(500).json({ message: "Server error" });
  }
};
