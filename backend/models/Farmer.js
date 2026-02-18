const mongoose = require("mongoose");

const farmerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
        unique: true,
    },
    language: {
        type: String,
        default: "en",
    },
    location: {
        type: String,
        default: "",
    },
    crops: [
        {
            name: String,
            area: Number,
            sowingDate: Date,
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("Farmer", farmerSchema);
