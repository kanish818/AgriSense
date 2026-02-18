const Groq = require("groq-sdk");
const User = require("../models/User");
const Chat = require("../models/Chat"); // Import the new Chat model
const { spawn } = require("child_process");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

exports.handleChat = async (req, res) => {
  try {
    const { message, language = "english" } = req.body;
    const userId = req.userId;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    // 1. Get Farmer Profile
    let farmer_profile = {};
    try {
      const user = await User.findById(userId).select("-password");
      if (user) {
        farmer_profile = {
          id: user._id.toString(),
          name: user.name,
          location: user.location,
          crops: user.crops || [],
          // NEW: Detailed profile
          details: user.farmDetails || {},
          history: user.cropHistory || []
        };
      }
    } catch (err) {
      console.warn("Profile fetch failed, continuing with empty profile.");
    }

    // 2. FETCH HISTORY (The "Memory")
    let history_context = [];
    try {
      let chatSession = await Chat.findOne({ userId });
      if (!chatSession) {
        chatSession = await Chat.create({ userId, messages: [] });
      }

      // Get last 5 exchanges (10 messages) for context window
      const recentMessages = chatSession.messages.slice(-10);
      history_context = recentMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
    } catch (error) {
      console.error("History Fetch Error:", error);
    }

    // 3. FAST: Call Groq directly
    const lang_map = { english: "English", hindi: "Hindi", punjabi: "Punjabi" };
    const target_lang = lang_map[language] || "English";

    // Format profile string
    const crops_str = (farmer_profile.crops || []).join(', ') || "Not specified";
    const details = farmer_profile.details || {};
    const history = (farmer_profile.history || []).map(h => `${h.cropName} (${h.year})`).join(', ');

    const profile_str = `
    - Name: ${farmer_profile.name || 'Farmer'}
    - Location: ${farmer_profile.location || 'India'}
    - Current Crops: ${crops_str}
    - Land Size: ${details.landSize || 'Unknown'}
    - Soil Type: ${details.soilType || 'Unknown'}
    - Irrigation: ${details.irrigationSource || 'Unknown'}
    - Farming Type: ${details.farmingType || 'Conventional'}
    - Crop History: ${history || 'None recorded'}
    `.trim();

    const system_prompt = `You are AgriSense, an expert agricultural AI assistant for Indian farmers. 
    Provide a DETAILED, COMPREHENSIVE, and PRACTICAL answer in ${target_lang}.
    
    USE THE FARMER'S PROFILE DATA TO PERSONALIZE YOUR ADVICE.
    For example, if they have 'Black Soil', recommend crops suitable for that.
    If they rely on 'Rainfed' irrigation, suggest drought-resistant variants.
    
    Your response should look like a professional consultation:
    1. Start with a direct answer.
    2. Use BULLET POINTS or numbered lists.
    3. Explain 'Why' and 'How' clearly.
    4. Mention specific fertilizers, medicines, or techniques.
    5. Be encouraging.
    
    Do NOT be concise. Give the farmer full dominance over the topic.`;

    const user_prompt = `FARMER PROFILE: ${profile_str}\n\nQUESTION: ${message}\n\nANSWER:`;

    try {
      // Construct message array with history
      const messages = [
        { role: "system", content: system_prompt },
        ...history_context, // Inject past conversation
        { role: "user", content: user_prompt }
      ];

      const completion = await groq.chat.completions.create({
        messages: messages,
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
        max_tokens: 1024
      });

      const answer = completion.choices[0].message.content;

      // 4. SAVE TO MEMORY (MongoDB)
      // Save User Message
      await Chat.findOneAndUpdate(
        { userId },
        {
          $push: { messages: { role: 'user', content: message } },
          $set: { lastUpdated: new Date() }
        },
        { upsert: true }
      );

      // Save Bot Answer
      await Chat.findOneAndUpdate(
        { userId },
        {
          $push: { messages: { role: 'assistant', content: answer } }
        }
      );

      // 5. BACKGROUND RAG (Optional - still useful for vector search later)
      const pythonInput = JSON.stringify({ message, answer, farmer_profile });
      spawn("python", ["python-scripts/save_to_rag.py", pythonInput], {
        detached: true,
        stdio: 'ignore'
      }).unref();

      res.json({
        response: answer,
        contexts_used: 0,
        audio: null
      });

    } catch (apiError) {
      console.error("Groq API Error:", apiError.message);
      res.status(503).json({
        message: "AI service temporarily unavailable",
        response: "I'm having a technical issue. Please try again."
      });
    }

  } catch (error) {
    console.error("Chat Controller Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
