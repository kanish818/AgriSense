const axios = require("axios");
const fs = require("fs");
const Groq = require("groq-sdk");
const User = require("../models/User");
const Chat = require("../models/Chat");
const { RAG_SERVICE_URL, ensureRagServiceReady } = require("../services/ragServiceManager");

const CHAT_MODE = (process.env.CHAT_MODE || "hybrid").toLowerCase();
const RAG_TIMEOUT_MS = Number(process.env.RAG_TIMEOUT_MS || 5000);
const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey || groqApiKey === "your_groq_api_key_here") {
  console.warn("⚠️  GROQ_API_KEY not configured in chatControllers. Chat feature will not work.");
}

const groq = groqApiKey && groqApiKey !== "your_groq_api_key_here"
  ? new Groq({ apiKey: groqApiKey })
  : null;

const langMap = { english: "English", hindi: "Hindi", punjabi: "Punjabi" };
const speechLangCodeMap = { english: "en", hindi: "hi", punjabi: "pa" };
const GENERIC_VOICE_TRANSCRIPTS = new Set([
  "thank you",
  "thank you.",
  "thanks",
  "thanks.",
  "thankyou",
  "okay",
  "ok",
  "bye",
  "bye.",
  "hello",
  "hello.",
]);

async function getFarmerProfile(userId) {
  try {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return {};
    }

    return {
      id: user._id.toString(),
      name: user.name,
      location: user.location,
      crops: user.crops || [],
      details: user.farmDetails || {},
      history: user.cropHistory || [],
    };
  } catch (error) {
    console.warn("Profile fetch failed, continuing with empty profile.");
    return {};
  }
}

async function getHistoryContext(userId) {
  try {
    let chatSession = await Chat.findOne({ userId });
    if (!chatSession) {
      chatSession = await Chat.create({ userId, messages: [] });
    }

    return chatSession.messages.slice(-10).map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));
  } catch (error) {
    console.error("History Fetch Error:", error);
    return [];
  }
}

async function saveChatMessages(userId, message, answer) {
  await Chat.findOneAndUpdate(
    { userId },
    {
      $push: { messages: { role: "user", content: message } },
      $set: { lastUpdated: new Date() },
    },
    { upsert: true }
  );

  await Chat.findOneAndUpdate(
    { userId },
    {
      $push: { messages: { role: "assistant", content: answer } },
    }
  );
}

async function saveToUserMemory(message, answer, farmerProfile) {
  try {
    await axios.post(
      `${RAG_SERVICE_URL}/memory`,
      { message, answer, farmer_profile: farmerProfile },
      { timeout: 5000 }
    );
  } catch (error) {
    console.warn("User memory save skipped:", error.message);
  }
}

function buildProfileString(farmerProfile) {
  const cropsStr = (farmerProfile.crops || []).join(", ") || "Not specified";
  const details = farmerProfile.details || {};
  const history = (farmerProfile.history || []).map((item) => `${item.cropName} (${item.year})`).join(", ");

  return `
- Name: ${farmerProfile.name || "Farmer"}
- Location: ${farmerProfile.location || "India"}
- Current Crops: ${cropsStr}
- Land Size: ${details.landSize || "Unknown"}
- Soil Type: ${details.soilType || "Unknown"}
- Irrigation: ${details.irrigationSource || "Unknown"}
- Farming Type: ${details.farmingType || "Conventional"}
- Crop History: ${history || "None recorded"}
`.trim();
}

async function generateHybridAnswer(message, language, farmerProfile, historyContext) {
  if (!groq) {
    throw new Error("Groq client is not configured");
  }

  const targetLang = langMap[language] || "English";
  const profileString = buildProfileString(farmerProfile);

  const systemPrompt = `You are AgriSense, an expert agricultural AI assistant for Indian farmers.
You MUST respond ENTIRELY and EXCLUSIVELY in ${targetLang}.
Even if the user asks a question in English or another language, YOUR OUTPUT MUST BE TRANSLATED TO AND RESPONDED IN ${targetLang}.

USE THE FARMER'S PROFILE DATA TO PERSONALIZE YOUR ADVICE.
For example, if they have 'Black Soil', recommend crops suitable for that.
If they rely on 'Rainfed' irrigation, suggest drought-resistant variants.

Your response should look like a professional consultation:
1. Start with a direct answer.
2. Use bullet points or numbered lists.
3. Explain why and how clearly.
4. Mention specific fertilizers, medicines, or techniques.
5. Keep the answer practical for Indian farmers.`;

  const userPrompt = `FARMER PROFILE: ${profileString}

QUESTION: ${message}

IMPORTANT RESTRICTION: You MUST answer the above question ENTIRELY in ${targetLang}, regardless of what language the question was asked in.

ANSWER IN ${targetLang.toUpperCase()}:`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...historyContext,
    { role: "user", content: userPrompt },
  ];

  const completion = await groq.chat.completions.create({
    messages,
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
    max_tokens: 1024,
  });

  return completion.choices[0].message.content;
}

async function generatePureRagAnswer(message, language, farmerProfile, historyContext) {
  await ensureRagServiceReady();

  const response = await axios.post(
    `${RAG_SERVICE_URL}/chat`,
    {
      message,
      language,
      farmer_profile: farmerProfile,
      history_context: historyContext,
      timeout_ms: RAG_TIMEOUT_MS,
    },
    {
      timeout: Math.max(RAG_TIMEOUT_MS + 15000, 20000),
    }
  );

  return response.data;
}

async function transcribeAudioUpload(file, language) {
  if (!groq) {
    throw new Error("Groq client is not configured");
  }

  const targetLanguage = speechLangCodeMap[language] || "en";
  const fileName = file.originalname || `voice-input.${(file.mimetype || "audio/webm").split("/")[1] || "webm"}`;
  const prompt = targetLanguage === "hi"
    ? "The speaker is using Hindi and may ask about Indian farming, weather, crops, or soil."
    : targetLanguage === "pa"
      ? "The speaker is using Punjabi and may ask about Indian farming, weather, crops, or soil."
      : "The speaker is using English and may ask about Indian farming, weather, crops, or soil.";

  const uploadableFile = await Groq.toFile(
    fs.createReadStream(file.path),
    fileName,
    { type: file.mimetype || undefined }
  );

  const transcription = await groq.audio.transcriptions.create({
    file: uploadableFile,
    model: "whisper-large-v3",
    language: targetLanguage,
    prompt,
    response_format: "json",
    temperature: 0,
  });

  return transcription.text?.trim() || "";
}

async function cleanupUploadedFile(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    console.warn("Temporary audio cleanup skipped:", error.message);
  }
}

function isLikelyHallucinatedVoiceTranscript(text, metadata = {}) {
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized) return true;

  const speechDetected = String(metadata.speechDetected || "").toLowerCase() === "true";
  const speechFrames = Number(metadata.speechFrames || 0);
  const maxAudioLevel = Number(metadata.maxAudioLevel || 0);

  if (!speechDetected && speechFrames < 3 && maxAudioLevel < 0.05) {
    return true;
  }

  if (GENERIC_VOICE_TRANSCRIPTS.has(normalized)) {
    if (!speechDetected || speechFrames < 6 || maxAudioLevel < 0.08) {
      return true;
    }
  }

  return false;
}

exports.handleChat = async (req, res) => {
  let uploadedFilePath = req.file?.path;
  try {
    if (!groqApiKey || groqApiKey === "your_groq_api_key_here") {
      return res.status(503).json({
        message: "Chat service is not configured. Please add GROQ_API_KEY to backend .env file",
        setupGuide: "Get your API key from: https://console.groq.com/keys",
        response: "Chat service is not available. Please contact the administrator.",
      });
    }

    const language = (req.body.language || "english").toLowerCase();
    const userId = req.userId;
    let message = typeof req.body.message === "string" ? req.body.message.trim() : "";
    let transcript = null;

    if (!message && req.file) {
      transcript = await transcribeAudioUpload(req.file, language);
      message = transcript;

      if (isLikelyHallucinatedVoiceTranscript(transcript, req.body)) {
        return res.status(422).json({
          message: "I could not clearly understand the voice input. Please speak closer to the microphone and try again.",
          transcript,
        });
      }
    }

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const farmerProfile = await getFarmerProfile(userId);
    const historyContext = await getHistoryContext(userId);
    const isPureRagMode = CHAT_MODE === "pure_rag";

    let answer = "";
    let source = isPureRagMode ? "rag" : "hybrid";
    let contextsUsed = 0;
    let retrievalMs = 0;
    let timedOut = false;

    if (isPureRagMode) {
      try {
        const ragResult = await generatePureRagAnswer(message, language, farmerProfile, historyContext);

        if (ragResult?.timed_out) {
          timedOut = true;
          source = "timeout_llm";
          answer = await generateHybridAnswer(message, language, farmerProfile, historyContext);
        } else {
          answer = ragResult?.response || "";
          contextsUsed = ragResult?.contexts_used || 0;
          retrievalMs = ragResult?.retrieval_ms || 0;
          source = "rag";
        }
      } catch (error) {
        console.warn("Pure RAG path failed, falling back to direct LLM:", error.message);
        timedOut = true;
        source = "timeout_llm";
        answer = await generateHybridAnswer(message, language, farmerProfile, historyContext);
      }
    } else {
      answer = await generateHybridAnswer(message, language, farmerProfile, historyContext);
    }

    await saveChatMessages(userId, message, answer);

    if (isPureRagMode) {
      saveToUserMemory(message, answer, farmerProfile);
    }

    res.json({
      response: answer,
      transcript,
      contexts_used: contextsUsed,
      source,
      retrieval_ms: retrievalMs,
      timed_out: timedOut,
      audio: null,
    });
  } catch (error) {
    console.error("Chat Controller Error:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    await cleanupUploadedFile(uploadedFilePath);
  }
};
