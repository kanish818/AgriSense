const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    location: { type: String, default: "" },
    language: { type: String, default: "english" },
    crops: [String], // Current active crops

    // 🌾 NEW: Detailed Farm Profile
    farmDetails: {
        landSize: { type: String, default: "" },        // e.g., "5 acres"
        soilType: { type: String, default: "" },        // e.g., "Black Cotton", "Loamy"
        irrigationSource: { type: String, default: "" },// e.g., "Tube Well", "Canal", "Rainfed"
        farmingType: { type: String, default: "Conventional" } // "Organic", "Conventional", "Mix"
    },

    // 📜 NEW: Crop History Tracking
    cropHistory: [{
        cropName: String,
        season: String,       // e.g., "Rabi 2024", "Kharif 2023"
        year: Number,
        yield: String,        // e.g., "20 Quintals/Acre"
        notes: String         // e.g., "Pest attack in late stage"
    }],

    createdAt: { type: Date, default: Date.now }
});

// Hash password before saving (Mongoose 9 compatible — no `next` parameter needed)
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
