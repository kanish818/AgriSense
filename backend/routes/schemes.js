const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

const schemesPath = path.join(__dirname, "..", "data", "schemes.json");

// GET /api/schemes — get all schemes, optionally filter by state
router.get("/", (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(schemesPath, "utf-8"));
        const { state, limit } = req.query;

        let filtered = data;
        if (state) {
            // Return schemes available in that state or available in "all" states
            filtered = data.filter(s =>
                s.states && (s.states.includes("all") || s.states.some(st => st.toLowerCase().includes(state.toLowerCase())))
            );
        }

        // Sort: state-specific schemes first, then national
        filtered.sort((a, b) => {
            const aSpecific = a.states && !a.states.includes("all") ? 0 : 1;
            const bSpecific = b.states && !b.states.includes("all") ? 0 : 1;
            return aSpecific - bSpecific;
        });

        if (limit) {
            filtered = filtered.slice(0, parseInt(limit));
        }

        res.json(filtered);
    } catch (error) {
        console.error("Schemes Error:", error);
        res.status(500).json({ message: "Failed to load schemes" });
    }
});

module.exports = router;
