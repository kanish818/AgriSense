const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { generateToken, verifyToken } = require("../middleware/auth");
const { OAuth2Client } = require("google-auth-library");

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
    try {
        const { name, email, password, location, language } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email, and password are required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered. Please login." });
        }

        const user = await User.create({ name, email, password, location, language, authProvider: "local" });
        const token = generateToken(user._id);

        res.status(201).json({
            message: "Account created successfully!",
            token,
            user: { id: user._id, name: user.name, email: user.email, location: user.location, language: user.language }
        });
    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ message: "Server error during signup" });
    }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        if (user.authProvider === "google" && !user.password) {
            return res.status(400).json({ message: "This account uses Google sign-in. Please continue with Google." });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = generateToken(user._id);

        res.json({
            message: "Login successful!",
            token,
            user: { id: user._id, name: user.name, email: user.email, location: user.location, language: user.language }
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Server error during login", error: error.message || error.toString() });
    }
});

// POST /api/auth/google
router.post("/google", async (req, res) => {
    try {
        if (!googleClient) {
            return res.status(503).json({ message: "Google sign-in is not configured on the server." });
        }

        const { credential, location, language } = req.body;
        if (!credential) {
            return res.status(400).json({ message: "Google credential is required" });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: googleClientId
        });

        const payload = ticket.getPayload();
        if (!payload?.email || !payload.email_verified) {
            return res.status(400).json({ message: "Google account email is not verified." });
        }

        let user = await User.findOne({
            $or: [{ googleId: payload.sub }, { email: payload.email.toLowerCase() }]
        });

        if (!user) {
            user = await User.create({
                name: payload.name || payload.email.split("@")[0],
                email: payload.email.toLowerCase(),
                googleId: payload.sub,
                authProvider: "google",
                location: location || "",
                language: language || "english"
            });
        } else {
            const updates = {};
            if (!user.googleId) updates.googleId = payload.sub;
            if (user.authProvider !== "google") updates.authProvider = "google";
            if (!user.name && payload.name) updates.name = payload.name;
            if (Object.keys(updates).length > 0) {
                user = await User.findByIdAndUpdate(user._id, { $set: updates }, { new: true });
            }
        }

        const token = generateToken(user._id);
        return res.json({
            message: "Google login successful!",
            token,
            user: { id: user._id, name: user.name, email: user.email, location: user.location, language: user.language }
        });
    } catch (error) {
        console.error("Google Login Error:", error);
        return res.status(500).json({ message: "Google sign-in failed", error: error.message || error.toString() });
    }
});

// GET /api/auth/me — get current user profile
router.get("/me", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ user });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// PUT /api/auth/profile — update farm details & crops
router.put("/profile", verifyToken, async (req, res) => {
    try {
        const { farmDetails, crops, location } = req.body;

        // Use findByIdAndUpdate for atomic update
        const user = await User.findByIdAndUpdate(
            req.userId,
            {
                $set: {
                    'farmDetails': farmDetails,
                    'crops': crops,
                    'location': location
                }
            },
            { new: true, runValidators: true }
        ).select("-password");

        res.json({ message: "Profile updated!", user });
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ message: "Failed to update profile" });
    }
});

// POST /api/auth/crop-history — add historical record
router.post("/crop-history", verifyToken, async (req, res) => {
    try {
        const { cropName, season, year, yield: yieldVal, notes } = req.body;

        const newRecord = { cropName, season, year, yield: yieldVal, notes };

        const user = await User.findByIdAndUpdate(
            req.userId,
            { $push: { cropHistory: newRecord } },
            { new: true }
        ).select("-password");

        res.json({ message: "Crop history added!", history: user.cropHistory });
    } catch (error) {
        console.error("History Application Error:", error);
        res.status(500).json({ message: "Failed to add history" });
    }
});

// DELETE /api/auth/crop-history/:id — remove record
router.delete("/crop-history/:id", verifyToken, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.userId,
            { $pull: { cropHistory: { _id: req.params.id } } },
            { new: true }
        );
        res.json({ message: "Record removed", history: user.cropHistory });
    } catch (error) {
        res.status(500).json({ message: "Failed to remove record" });
    }
});

module.exports = router;
