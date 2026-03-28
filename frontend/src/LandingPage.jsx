import React, { useState, useEffect, useRef } from 'react';
import { Sun, Cloud, Droplets, Wind, MessageSquare, CreditCard, Menu, X, ChevronDown, Mic, MicOff, Send, Upload, Leaf, Sprout, FileText, ExternalLink, ThermometerSun, MapPin, LogOut, User, Volume2, VolumeX } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:9000/api';

export default function LandingPage({ user, token, onLogout, onRequireAuth }) {
  // Core
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState(user?.language || 'english');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  // Data
  const [weather, setWeather] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [weatherError, setWeatherError] = useState(false);

  // Chat
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Voice
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  // Modals
  const [showSoilModal, setShowSoilModal] = useState(false);
  const [showPlantModal, setShowPlantModal] = useState(false);
  const [showCropAdvisory, setShowCropAdvisory] = useState(false);
  const [showFinancialHelp, setShowFinancialHelp] = useState(false);
  const [showSchemesModal, setShowSchemesModal] = useState(false);

  // Analysis
  const [analysisResult, setAnalysisResult] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [cropAdviceResult, setCropAdviceResult] = useState('');
  const [financialResult, setFinancialResult] = useState('');
  const [cropForm, setCropForm] = useState({ location: user?.location || '', season: 'Kharif', soilType: '' });
  const [financialTopic, setFinancialTopic] = useState('');
  const [locationStatus, setLocationStatus] = useState('prompt');
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // 🚜 Profile & Farm Logic
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({
    farmDetails: { landSize: '', soilType: '', irrigationSource: '', farmingType: 'Conventional' },
    cropHistory: []
  });
  const [newCropHistory, setNewCropHistory] = useState({ cropName: '', season: '', year: new Date().getFullYear(), yield: '', notes: '' });

  // Fetch Profile
  const fetchProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
      const data = await res.json();
      if (data.user) {
        setProfileData({
          farmDetails: data.user.farmDetails || {},
          cropHistory: data.user.cropHistory || []
        });
      }
    } catch (e) { console.error("Profile fetch error", e); }
  };

  // Update Profile
  const updateProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          farmDetails: profileData.farmDetails,
          location: user.location
        })
      });
      if (res.ok) alert('✅ Farm Profile Updated!');
    } catch (e) { alert('❌ Update failed'); }
  };

  // Add Crop History
  const addCropHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/crop-history`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newCropHistory)
      });
      const data = await res.json();
      if (res.ok) {
        setProfileData(prev => ({ ...prev, cropHistory: data.history }));
        setNewCropHistory({ cropName: '', season: '', year: new Date().getFullYear(), yield: '', notes: '' });
      }
    } catch (e) { alert('❌ Failed to add history'); }
  };

  useEffect(() => { if (showProfileModal) fetchProfile(); }, [showProfileModal]);

  // Auth gate — if user tries to use feature but not logged in
  const requireAuth = (fn) => {
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    fn();
  };

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // Request location permission manually
  const requestLocationPermission = () => {
    setIsRequestingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationStatus('granted');
          fetchWeather(pos.coords.latitude, pos.coords.longitude);
          setIsRequestingLocation(false);
        },
        (err) => {
          console.error("Location permission denied:", err);
          setLocationStatus('denied');
          setWeatherError(true);
          setIsRequestingLocation(false);
          fetchWeather(28.61, 77.20);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationStatus('unavailable');
      setWeatherError(true);
      setIsRequestingLocation(false);
      fetchWeather(28.61, 77.20);
    }
  };

  // Scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  // Fetch weather + schemes - check permission first
  useEffect(() => {
    // Check if we already have permission
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationStatus(result.state);
        if (result.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
            () => fetchWeather(28.61, 77.20)
          );
        } else if (result.state === 'denied') {
          // User previously denied, use default location (New Delhi)
          setWeatherError(false);
          fetchWeather(28.61, 77.20);
        }
        // If 'prompt', do nothing — user must click the "Share My Location" button
      });
    } else {
      // Browser doesn't support permissions API — directly try geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocationStatus('granted');
            fetchWeather(pos.coords.latitude, pos.coords.longitude);
          },
          () => {
            setLocationStatus('denied');
            fetchWeather(28.61, 77.20);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        setLocationStatus('unavailable');
        fetchWeather(28.61, 77.20);
      }
    }

    const state = user?.location || '';
    fetch(`${API_BASE}/schemes?state=${encodeURIComponent(state)}&limit=10`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setSchemes(d); })
      .catch(() => { });
  }, []);

  // Welcome message for chat
  useEffect(() => {
    if (isChatOpen && chatHistory.length === 0) {
      const welcome = {
        english: 'Hello! I am AgriSense, your AI farming assistant. Ask me anything about crops, weather, soil, or farming techniques! 🌾',
        hindi: 'नमस्ते! मैं AgriSense हूँ, आपका AI कृषि सहायक। फसल, मौसम, मिट्टी या खेती से जुड़ा कोई भी सवाल पूछें! 🌾',
        punjabi: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ AgriSense ਹਾਂ, ਤੁਹਾਡਾ AI ਖੇਤੀ ਸਹਾਇਕ। ਫ਼ਸਲ, ਮੌਸਮ, ਮਿੱਟੀ ਜਾਂ ਖੇਤੀ ਬਾਰੇ ਕੁਝ ਵੀ ਪੁੱਛੋ! 🌾'
      };
      setChatHistory([{ role: 'bot', content: welcome[language] || welcome.english }]);
    }
  }, [isChatOpen]);

  // Init speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      const langCodes = { english: 'en-IN', hindi: 'hi-IN', punjabi: 'pa-IN' };
      recognition.lang = langCodes[language] || 'en-IN';
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setChatMessage(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, [language]);

  // Init TTS
  useEffect(() => {
    if (window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
      // Load voices
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {
          speechSynthesis.getVoices();
        };
      }
    }
  }, []);

  // Speak function with bulletproof Cloud TTS for regional languages
  const speakText = (text) => {
    // Stop any ongoing speech
    if (synthRef.current) synthRef.current.cancel();
    if (window.currentAudio) {
      window.currentAudio.pause();
      window.currentAudio = null;
    }

    const langCodeMap = {
      english: 'en-IN',
      hindi: 'hi-IN',
      punjabi: 'pa-IN'
    };
    const targetLang = langCodeMap[language] || 'en-IN';

    // Cloud TTS Fallback execution using reliable googleapis endpoint
    const playCloudTTS = (textToSpeak, langCode) => {
      const cleanText = textToSpeak.replace(/[\*\#\_]/g, '');
      const chunks = [];
      let currentChunk = '';
      const words = cleanText.split(/([\s.!?।]+)/);
      for (const word of words) {
        if ((currentChunk + word).length > 180) {
          if (currentChunk.trim()) chunks.push(currentChunk);
          currentChunk = word;
        } else {
          currentChunk += word;
        }
      }
      if (currentChunk.trim()) chunks.push(currentChunk);

      let i = 0;
      const playNext = () => {
        if (i >= chunks.length) {
          setIsSpeaking(false);
          return;
        }
        const chunkText = chunks[i].trim();
        if (!chunkText) {
          i++; playNext(); return;
        }
        const audio = new Audio(`https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${langCode.split('-')[0]}&q=${encodeURIComponent(chunkText)}`);
        window.currentAudio = audio;
        audio.onended = () => { i++; playNext(); };
        audio.onerror = () => { i++; playNext(); };
        audio.play().catch(e => { console.error('Cloud TTS Audio play error', e); setIsSpeaking(false); });
      };
      setIsSpeaking(true);
      playNext();
    };

    // FORCE Cloud TTS for Hindi and Punjabi (bypasses broken/missing OS system voices)
    if (language !== 'english') {
      playCloudTTS(text, targetLang);
      return;
    }

    // Default to Web Speech API for English
    if (!synthRef.current) {
      playCloudTTS(text, targetLang);
      return;
    }

    const voices = synthRef.current.getVoices();
    const selectedVoice = voices.find(v => v.lang.includes('en-IN') || v.name.toLowerCase().includes('india')) || voices.find(v => v.lang.includes('en'));

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang;
    if (selectedVoice) utterance.voice = selectedVoice;
    
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error('TTS Error:', e);
      setIsSpeaking(false);
    };

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) synthRef.current.cancel();
    if (window.currentAudio) {
      window.currentAudio.pause();
      window.currentAudio.src = "";
      window.currentAudio = null;
    }
    setIsSpeaking(false);
  };

  const fetchWeather = (lat, lon) => {
    fetch(`${API_BASE}/weather?lat=${lat}&lon=${lon}`)
      .then(r => r.json()).then(d => { 
        if (d.main) {
          setWeather(d); 
          setWeatherError(false);
        } else {
          console.error("Weather API error:", d.message);
          setWeatherError(true);
        }
      })
      .catch((err) => {
        console.error("Weather fetch error:", err);
        setWeatherError(true);
      });
  };

  // Chat
  const handleChatSubmit = async (e) => {
    e?.preventDefault();
    if (!chatMessage.trim() || isLoading) return;
    if (!token) { onRequireAuth(); return; }

    const userMsg = chatMessage.trim();
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatMessage('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ message: userMsg, language })
      });

      // Handle cases where the backend (Render) returns a 502/503 HTML error page during deployment or sleep
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server is restarting or deploying updates. Please wait a moment and try again.");
      }

      const data = await res.json();
      if (res.status === 401) { onRequireAuth(); return; }
      if (res.status === 503 && data.setupGuide) {
        const botResponse = `⚠️ ${data.response || data.message}\n\nSetup Guide: ${data.setupGuide}`;
        setChatHistory(prev => [...prev, { role: 'bot', content: botResponse }]);
        return;
      }
      
      const botResponse = data.response || data.message || 'Sorry, something went wrong.';
      setChatHistory(prev => [...prev, { role: 'bot', content: botResponse }]);
    } catch (err) {
      console.error("Chat error:", err);
      // Give a contextual warning if the server is starting
      const isRestarting = err.message.includes('restarting') || err.message.includes('Unexpected token');
      const errorMsg = isRestarting 
        ? '⏳ The AI server is currently restarting or deploying updates. Please wait about 30 seconds and ask again.' 
        : '❌ Could not connect to the server. Please ensure your internet is stable and the backend is running.';
      setChatHistory(prev => [...prev, { role: 'bot', content: errorMsg }]);
    } finally { setIsLoading(false); }
  };

  // Voice
  const toggleVoice = () => {
    if (!user) { onRequireAuth(); return; }
    if (!recognitionRef.current) { alert('Voice input is not supported in your browser. Please use Chrome.'); return; }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Update language
      const langCodes = { english: 'en-IN', hindi: 'hi-IN', punjabi: 'pa-IN' };
      recognitionRef.current.lang = langCodes[language] || 'en-IN';
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Voice for hero button - opens chat with voice
  const startVoiceChat = () => {
    requireAuth(() => {
      setIsChatOpen(true);
      setTimeout(() => toggleVoice(), 500);
    });
  };

  // Soil
  const handleSoilAnalysis = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setAnalysisLoading(true); setAnalysisResult('');
    const formData = new FormData();
    formData.append('soilImage', file);
    try {
      const res = await fetch(`${API_BASE}/analyze-soil`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (res.status === 401) { onRequireAuth(); return; }
      if (res.status === 503 && data.setupGuide) {
        setAnalysisResult(`⚠️ ${data.message}\n\nSetup Guide: ${data.setupGuide}`);
        return;
      }
      const result = data.crops || data.message || 'Analysis failed.';
      setAnalysisResult(result);
    } catch (err) {
      console.error("Soil analysis error:", err);
      setAnalysisResult('❌ Failed to connect to server. Please ensure the backend is running.');
    }
    finally { setAnalysisLoading(false); }
  };

  // Plant
  const handlePlantAnalysis = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setAnalysisLoading(true); setAnalysisResult('');
    const formData = new FormData();
    formData.append('plantImage', file);
    try {
      const res = await fetch(`${API_BASE}/analyze-plant`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (res.status === 401) { onRequireAuth(); return; }
      if (res.status === 503 && data.setupGuide) {
        setAnalysisResult(`⚠️ ${data.message}\n\nSetup Guide: ${data.setupGuide}`);
        return;
      }
      const result = data.health || data.message || 'Analysis failed.';
      setAnalysisResult(result);
    } catch (err) {
      console.error("Plant analysis error:", err);
      setAnalysisResult('❌ Failed to connect to server. Please ensure the backend is running.');
    }
    finally { setAnalysisLoading(false); }
  };

  // Crop advice
  const handleCropAdvice = async () => {
    setAnalysisLoading(true); setCropAdviceResult('');
    try {
      const res = await fetch(`${API_BASE}/crop-advice`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...cropForm, language }) });
      const data = await res.json();
      if (res.status === 401) { onRequireAuth(); return; }
      if (res.status === 503 && data.setupGuide) {
        setCropAdviceResult(`⚠️ ${data.message}\n\nSetup Guide: ${data.setupGuide}`);
        return;
      }
      const advice = data.advice || data.message || 'No advice.';
      setCropAdviceResult(advice);
    } catch (err) {
      console.error("Crop advice error:", err);
      setCropAdviceResult('❌ Server not reachable. Please ensure the backend is running.');
    }
    finally { setAnalysisLoading(false); }
  };

  // Financial
  const handleFinancialGuidance = async () => {
    setAnalysisLoading(true); setFinancialResult('');
    try {
      const res = await fetch(`${API_BASE}/financial-guidance`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ topic: financialTopic, language }) });
      const data = await res.json();
      if (res.status === 401) { onRequireAuth(); return; }
      if (res.status === 503 && data.setupGuide) {
        setFinancialResult(`⚠️ ${data.message}\n\nSetup Guide: ${data.setupGuide}`);
        return;
      }
      const guidance = data.guidance || data.message || 'No guidance.';
      setFinancialResult(guidance);
    } catch (err) {
      console.error("Financial guidance error:", err);
      setFinancialResult('❌ Server not reachable. Please ensure the backend is running.');
    }
    finally { setAnalysisLoading(false); }
  };

  const scrollToSection = (id) => { setActiveSection(id); setMobileMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

  useEffect(() => {
    const fn = () => setLangDropdownOpen(false);
    if (langDropdownOpen) {
      setTimeout(() => document.addEventListener('click', fn), 0);
    }
    return () => document.removeEventListener('click', fn);
  }, [langDropdownOpen]);

  // Translations
  const t = {
    english: {
      nav: [{ label: 'Home', id: 'home' }, { label: 'Features', id: 'features' }, { label: 'Weather', id: 'weather-section' }, { label: 'Schemes', id: 'weather-section' }, { label: 'Chat', id: 'chat-fab' }],
      hero: { title: 'Your Smart Farming Assistant', subtitle: 'AI-powered crop advice, weather updates, disease detection, and government scheme information — all in one place.', cta: 'Chat with AI', voice: 'Voice Assistant' },
      features: {
        title: 'What AgriSense Can Do', subtitle: 'Click any card to get started', items: [
          { title: 'Crop Advisory', desc: 'Get AI crop recommendations based on location, season, and soil.' },
          { title: 'Plant Disease Detection', desc: 'Upload a photo to identify diseases and get remedies.' },
          { title: 'Soil Analysis', desc: 'Upload soil photo to get crop suitability recommendations.' },
          { title: 'Financial Guidance', desc: 'Get advice on loans, subsidies, insurance, and savings.' },
        ]
      },
      weather: { title: "Today's Weather", loading: 'Loading weather...', error: 'Weather unavailable' },
      schemes: { title: 'Government Schemes', viewAll: 'View All Schemes', topSchemes: 'Top schemes for your area' },
      loginRequired: 'Please login to use this feature',
    },
    hindi: {
      nav: [{ label: 'होम', id: 'home' }, { label: 'सुविधाएँ', id: 'features' }, { label: 'मौसम', id: 'weather-section' }, { label: 'योजनाएँ', id: 'weather-section' }, { label: 'चैट', id: 'chat-fab' }],
      hero: { title: 'आपका स्मार्ट कृषि सहायक', subtitle: 'AI-संचालित फसल सलाह, मौसम अपडेट, रोग पहचान और सरकारी योजनाओं की जानकारी — सब एक जगह।', cta: 'AI से बात करें', voice: 'आवाज सहायक' },
      features: {
        title: 'AgriSense क्या कर सकता है', subtitle: 'शुरू करने के लिए किसी भी कार्ड पर क्लिक करें', items: [
          { title: 'फसल सलाह', desc: 'स्थान, मौसम और मिट्टी के आधार पर AI फसल अनुशंसाएँ।' },
          { title: 'पौधों के रोग की पहचान', desc: 'रोगों की पहचान के लिए फोटो अपलोड करें।' },
          { title: 'मिट्टी विश्लेषण', desc: 'मिट्टी की फोटो से फसल अनुकूलता जानें।' },
          { title: 'वित्तीय मार्गदर्शन', desc: 'ऋण, सब्सिडी, बीमा और बचत पर सलाह।' },
        ]
      },
      weather: { title: 'आज का मौसम', loading: 'मौसम लोड हो रहा है...', error: 'मौसम उपलब्ध नहीं' },
      schemes: { title: 'सरकारी योजनाएँ', viewAll: 'सभी योजनाएँ देखें', topSchemes: 'आपके क्षेत्र की शीर्ष योजनाएँ' },
      loginRequired: 'इस सुविधा का उपयोग करने के लिए कृपया लॉगिन करें',
    },
    punjabi: {
      nav: [{ label: 'ਘਰ', id: 'home' }, { label: 'ਸੁਵਿਧਾਵਾਂ', id: 'features' }, { label: 'ਮੌਸਮ', id: 'weather-section' }, { label: 'ਯੋਜਨਾਵਾਂ', id: 'weather-section' }, { label: 'ਗੱਲਬਾਤ', id: 'chat-fab' }],
      hero: { title: 'ਤੁਹਾਡਾ ਸਮਾਰਟ ਖੇਤੀ ਸਹਾਇਕ', subtitle: 'AI-ਸੰਚਾਲਿਤ ਫ਼ਸਲ ਸਲਾਹ, ਮੌਸਮ ਅੱਪਡੇਟ, ਬਿਮਾਰੀ ਪਛਾਣ ਅਤੇ ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ ਦੀ ਜਾਣਕਾਰੀ — ਸਭ ਇੱਕ ਥਾਂ।', cta: 'AI ਨਾਲ ਗੱਲ ਕਰੋ', voice: 'ਆਵਾਜ਼ ਸਹਾਇਕ' },
      features: {
        title: 'AgriSense ਕੀ ਕਰ ਸਕਦਾ ਹੈ', subtitle: 'ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਕਿਸੇ ਵੀ ਕਾਰਡ \'ਤੇ ਕਲਿੱਕ ਕਰੋ', items: [
          { title: 'ਫ਼ਸਲ ਸਲਾਹ', desc: 'ਸਥਾਨ, ਮੌਸਮ ਅਤੇ ਮਿੱਟੀ ਦੇ ਆਧਾਰ \'ਤੇ AI ਫ਼ਸਲ ਸਿਫ਼ਾਰਸ਼ਾਂ।' },
          { title: 'ਪੌਦਿਆਂ ਦੀ ਬਿਮਾਰੀ ਪਛਾਣ', desc: 'ਬਿਮਾਰੀਆਂ ਦੀ ਪਛਾਣ ਲਈ ਫੋਟੋ ਅੱਪਲੋਡ ਕਰੋ।' },
          { title: 'ਮਿੱਟੀ ਵਿਸ਼ਲੇਸ਼ਣ', desc: 'ਮਿੱਟੀ ਦੀ ਫੋਟੋ ਤੋਂ ਫ਼ਸਲ ਅਨੁਕੂਲਤਾ ਜਾਣੋ।' },
          { title: 'ਵਿੱਤੀ ਮਾਰਗਦਰਸ਼ਨ', desc: 'ਕਰਜ਼ੇ, ਸਬਸਿਡੀ, ਬੀਮਾ ਅਤੇ ਬੱਚਤ ਬਾਰੇ ਸਲਾਹ।' },
        ]
      },
      weather: { title: 'ਅੱਜ ਦਾ ਮੌਸਮ', loading: 'ਮੌਸਮ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...', error: 'ਮੌਸਮ ਉਪਲਬਧ ਨਹੀਂ' },
      schemes: { title: 'ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ', viewAll: 'ਸਾਰੀਆਂ ਯੋਜਨਾਵਾਂ ਦੇਖੋ', topSchemes: 'ਤੁਹਾਡੇ ਖੇਤਰ ਦੀਆਂ ਚੋਟੀ ਦੀਆਂ ਯੋਜਨਾਵਾਂ' },
      loginRequired: 'ਇਸ ਸੁਵਿਧਾ ਦੀ ਵਰਤੋਂ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਲੌਗਇਨ ਕਰੋ',
    }
  };

  const content = t[language] || t.english;
  const featureIcons = [<Sprout className="h-8 w-8" />, <Leaf className="h-8 w-8" />, <ThermometerSun className="h-8 w-8" />, <CreditCard className="h-8 w-8" />];
  const featureActions = [
    () => requireAuth(() => setShowCropAdvisory(true)),
    () => requireAuth(() => setShowPlantModal(true)),
    () => requireAuth(() => setShowSoilModal(true)),
    () => requireAuth(() => setShowFinancialHelp(true)),
  ];

  return (
    <div className="min-h-screen font-sans bg-gray-50">

      {/* ===== NAVBAR ===== */}
      <nav className="bg-green-800 shadow-lg text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-green-800 font-bold text-lg">🌾</div>
              <span className="ml-2 text-xl font-bold tracking-tight">AgriSense</span>
              <div className="hidden md:ml-8 md:flex md:space-x-1">
                {content.nav.map((item, i) => (
                  <button key={i} onClick={() => item.id === 'chat-fab' ? requireAuth(() => setIsChatOpen(true)) : scrollToSection(item.id)}
                    className="px-3 py-2 text-sm font-medium rounded-md transition-colors text-green-100 hover:bg-green-700 hover:text-white">{item.label}</button>
                ))}
              </div>
            </div>
            {/* Desktop Nav */}
            <div className="hidden md:ml-6 md:flex md:items-center space-x-3">
              <div className="relative">
                <button
                  onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                  className="flex items-center space-x-2 text-white hover:text-green-100 bg-green-700 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                >
                  <span className="uppercase tracking-wide">{language === 'english' ? 'EN' : language === 'hindi' ? 'HI' : 'PA'}</span>
                  <ChevronDown size={14} />
                </button>
                {langDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden transform transition-all duration-200 origin-top-right">
                    <div className="py-1">
                      {['english', 'hindi', 'punjabi'].map((lang) => (
                        <button
                          key={lang}
                          onClick={() => { setLanguage(lang); setLangDropdownOpen(false); }}
                          className={`block w-full text-left px-4 py-3 text-sm hover:bg-green-50 transition-colors ${language === lang ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-700'}`}
                        >
                          {lang.charAt(0).toUpperCase() + lang.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {user ? (
                <div className="flex items-center space-x-3">
                  <span className="text-green-100 text-sm font-medium hidden lg:inline-block">Hi, {user.name}</span>
                  <button onClick={() => setShowProfileModal(true)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-sm transition-all flex items-center space-x-2">
                    <User size={16} />
                    <span>My Farm</span>
                  </button>
                  <button onClick={onLogout} title="Logout" className="bg-red-500 hover:bg-red-600 p-2 rounded-full text-white shadow-sm transition-colors">
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <a
                  href="/auth"
                  className="bg-white text-green-700 px-5 py-2 rounded-full text-sm font-bold hover:bg-gray-100 shadow-md transition-all transform hover:scale-105 active:scale-95"
                >
                  Login / Sign Up
                </a>
              )}
            </div>
            <div className="md:hidden flex items-center">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-md text-white hover:bg-green-700">
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-green-700">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {content.nav.map((item, i) => (
                <button key={i} onClick={() => { item.id === 'chat-fab' ? requireAuth(() => { setIsChatOpen(true); setMobileMenuOpen(false); }) : scrollToSection(item.id); }}
                  className="block w-full text-left px-3 py-2 rounded-md text-white hover:bg-green-700">{item.label}</button>
              ))}
              <div className="flex space-x-2 px-3 pt-2 border-t border-green-700">
                {[['english', 'EN'], ['hindi', 'हिंदी'], ['punjabi', 'ਪੰਜਾਬੀ']].map(([val, lbl]) => (
                  <button key={val} className={`px-3 py-1 rounded text-xs ${language === val ? 'bg-white text-green-800' : 'bg-green-700 text-white'}`} onClick={() => setLanguage(val)}>{lbl}</button>
                ))}
              </div>
              {user ? (
                <button onClick={onLogout} className="block w-full text-left px-3 py-2 text-red-300 hover:bg-green-700 mt-2">Logout ({user.name})</button>
              ) : (
                <a href="/auth" className="block w-full text-left px-3 py-2 text-orange-300 hover:bg-green-700 mt-2 font-medium">Login / Sign Up</a>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ===== HERO ===== */}
      <section id="home" className="bg-gradient-to-br from-green-50 via-orange-50 to-yellow-50 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:flex lg:items-center lg:gap-12">
            <div className="lg:w-1/2">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-green-800 mb-6 leading-tight">{content.hero.title}</h1>
              <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">{content.hero.subtitle}</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => requireAuth(() => setIsChatOpen(true))}
                  className="bg-green-800 hover:bg-green-900 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
                  <MessageSquare className="h-5 w-5" />{content.hero.cta}
                </button>
                <button onClick={startVoiceChat}
                  className="flex items-center justify-center px-8 py-4 border-2 border-green-800 rounded-xl text-green-800 font-semibold text-lg hover:bg-green-800 hover:text-white transition-all">
                  <Mic className="mr-2 h-5 w-5" />{content.hero.voice}
                </button>
              </div>
              {!user && (
                <p className="mt-4 text-sm text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 inline-block">
                  ⚠️ {content.loginRequired} → <a href="/auth" className="text-green-700 font-semibold underline">Login / Sign Up</a>
                </p>
              )}
            </div>
            <div className="mt-12 lg:mt-0 lg:w-1/2">
              {weather && weather.main ? (
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="bg-yellow-100 p-4 rounded-full"><Sun className="h-10 w-10 text-yellow-500" /></div>
                    <div>
                      <p className="text-4xl font-bold text-gray-800">{Math.round(weather.main.temp)}°C</p>
                      <p className="text-gray-500 capitalize text-lg">{weather.weather[0].description}</p>
                      <p className="text-sm text-gray-400 flex items-center gap-1"><MapPin className="h-3 w-3" />{weather.name}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-blue-50 rounded-lg p-3 text-center"><Droplets className="h-5 w-5 mx-auto text-blue-500 mb-1" /><p className="text-sm text-gray-600">Humidity</p><p className="font-bold text-gray-800">{weather.main.humidity}%</p></div>
                    <div className="bg-green-50 rounded-lg p-3 text-center"><Wind className="h-5 w-5 mx-auto text-green-500 mb-1" /><p className="text-sm text-gray-600">Wind</p><p className="font-bold text-gray-800">{Math.round(weather.wind.speed)} m/s</p></div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center"><ThermometerSun className="h-5 w-5 mx-auto text-orange-500 mb-1" /><p className="text-sm text-gray-600">Feels Like</p><p className="font-bold text-gray-800">{Math.round(weather.main.feels_like)}°C</p></div>
                  </div>
                </div>
              ) : !weatherError ? (
                <div className="bg-white rounded-2xl shadow-xl p-12 text-center border">
                  {locationStatus === 'prompt' ? (
                    <div>
                      <MapPin className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">Allow access to your location for accurate weather</p>
                      <button 
                        onClick={requestLocationPermission}
                        disabled={isRequestingLocation}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
                      >
                        {isRequestingLocation ? 'Requesting...' : '📍 Share My Location'}
                      </button>
                    </div>
                  ) : (
                    <div><div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div><p className="text-gray-500">{content.weather.loading}</p></div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-xl p-12 text-center border border-red-100"><Cloud className="h-12 w-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-500">{content.weather.error}</p></div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-green-800 mb-2">{content.features.title}</h2>
          <p className="text-center text-gray-500 mb-12">{content.features.subtitle}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {content.features.items.map((feature, i) => (
              <button key={i} onClick={featureActions[i]}
                className="text-left rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-xl transition-all transform hover:-translate-y-1 bg-white group cursor-pointer">
                <div className="text-orange-500 mb-4 group-hover:scale-110 transition-transform">{featureIcons[i]}</div>
                <h3 className="text-lg font-bold text-green-800 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.desc}</p>
                <p className="mt-3 text-orange-500 text-sm font-medium">Click to use →</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WEATHER & SCHEMES ===== */}
      <section id="weather-section" className="py-16 bg-green-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:flex lg:gap-12">
            <div className="lg:w-1/2 mb-8 lg:mb-0">
              <h2 className="text-3xl font-bold mb-6">{content.weather.title}</h2>
              {weather && weather.main ? (
                <div className="bg-white bg-opacity-10 backdrop-blur rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="bg-white bg-opacity-20 p-3 rounded-full"><Sun className="h-8 w-8 text-yellow-300" /></div>
                    <div>
                      <p className="text-3xl font-bold">{Math.round(weather.main.temp)}°C</p>
                      <p className="text-green-200 capitalize">{weather.weather[0].description}</p>
                      <p className="text-sm text-green-300 flex items-center gap-1"><MapPin className="h-3 w-3" />{weather.name}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-white bg-opacity-10 rounded-lg p-3"><p className="text-xs text-green-300">Humidity</p><p className="font-bold">{weather.main.humidity}%</p></div>
                    <div className="bg-white bg-opacity-10 rounded-lg p-3"><p className="text-xs text-green-300">Wind</p><p className="font-bold">{Math.round(weather.wind.speed)} m/s</p></div>
                    <div className="bg-white bg-opacity-10 rounded-lg p-3"><p className="text-xs text-green-300">Min</p><p className="font-bold">{Math.round(weather.main.temp_min)}°C</p></div>
                    <div className="bg-white bg-opacity-10 rounded-lg p-3"><p className="text-xs text-green-300">Max</p><p className="font-bold">{Math.round(weather.main.temp_max)}°C</p></div>
                  </div>
                </div>
              ) : (
                <div className="bg-white bg-opacity-10 rounded-xl p-12 text-center">
                  {locationStatus === 'prompt' ? (
                    <div>
                      <MapPin className="h-12 w-12 text-white mx-auto mb-4" />
                      <p className="text-green-200 mb-4">Allow access to your location for accurate weather</p>
                      <button 
                        onClick={requestLocationPermission}
                        disabled={isRequestingLocation}
                        className="bg-white text-green-800 px-6 py-3 rounded-xl font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        {isRequestingLocation ? 'Requesting...' : '📍 Share My Location'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-green-200">{weatherError ? content.weather.error : content.weather.loading}</p>
                  )}
                </div>
              )}
            </div>
            <div className="lg:w-1/2">
              <h2 className="text-3xl font-bold mb-2">{content.schemes.title}</h2>
              <p className="text-green-300 text-sm mb-4">{content.schemes.topSchemes}</p>
              <div className="bg-white bg-opacity-10 backdrop-blur rounded-xl p-4 max-h-80 overflow-y-auto space-y-2">
                {schemes.length > 0 ? schemes.map((s, i) => (
                  <div key={i} className="bg-white bg-opacity-10 rounded-lg p-3 hover:bg-opacity-20 transition-colors">
                    <p className="font-bold text-sm">{s.name}</p>
                    <p className="text-xs text-green-200 mt-1">{s.benefits}</p>
                    {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-orange-300 hover:text-orange-200 mt-1"><ExternalLink className="h-3 w-3" />Visit</a>}
                  </div>
                )) : <p className="text-green-200 text-center py-8">Loading schemes...</p>}
              </div>
              <button onClick={() => setShowSchemesModal(true)} className="mt-4 bg-orange-500 hover:bg-orange-600 px-6 py-3 rounded-lg font-medium transition-colors">{content.schemes.viewAll}</button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CHAT MODAL ===== */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50" onClick={(e) => { if (e.target === e.currentTarget) setIsChatOpen(false); }}>
          <div className="bg-white w-full sm:max-w-lg sm:h-[600px] h-[85vh] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 bg-green-800 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-white rounded-full flex items-center justify-center text-lg">🌾</div>
                <div><h3 className="font-bold">AgriSense AI</h3><p className="text-xs text-green-200">{language === 'punjabi' ? 'ਪੰਜਾਬੀ ਵਿੱਚ' : language === 'hindi' ? 'हिंदी में' : 'English'}</p></div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="hover:bg-green-700 p-1 rounded"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-3">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-green-800 text-white rounded-br-md' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'}`}>
                    {msg.content}
                    {msg.role === 'bot' && (
                      <div className="mt-2 text-right">
                        <button onClick={() => speakText(msg.content)} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 transition-colors">
                          <Volume2 size={14} /> Listen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start"><div className="bg-white border rounded-2xl rounded-bl-md p-3 shadow-sm"><div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div></div></div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleChatSubmit} className="p-3 border-t bg-white flex gap-2">
              <button type="button" onClick={toggleVoice} className={`p-3 rounded-xl transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button type="button" onClick={isSpeaking ? stopSpeaking : null} className={`p-3 rounded-xl transition-colors ${isSpeaking ? 'bg-blue-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500'}`} title={isSpeaking ? 'Stop speaking' : 'Voice output enabled'}>
                {isSpeaking ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)}
                placeholder={language === 'punjabi' ? 'ਫ਼ਸਲ, ਮੌਸਮ ਬਾਰੇ ਪੁੱਛੋ...' : language === 'hindi' ? 'फसल, मौसम के बारे में पूछें...' : 'Ask about crops, weather, soil...'}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <button type="submit" disabled={isLoading || !chatMessage.trim()} className="bg-green-800 hover:bg-green-900 disabled:bg-gray-300 p-3 rounded-xl text-white transition-colors">
                <Send className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== FLOATING CHAT ===== */}
      {!isChatOpen && (
        <button id="chat-fab" onClick={() => requireAuth(() => setIsChatOpen(true))}
          className="fixed bottom-6 right-6 z-40 bg-green-800 hover:bg-green-900 text-white p-4 rounded-full shadow-2xl transition-all transform hover:scale-110 flex items-center gap-2">
          <MessageSquare className="h-6 w-6" /><span className="hidden sm:inline text-sm font-medium pr-1">Chat</span>
        </button>
      )}

      {/* ===== SOIL MODAL ===== */}
      {showSoilModal && (<Modal title="🌍 Soil Analysis" onClose={() => { setShowSoilModal(false); setAnalysisResult(''); }}>
        <p className="text-gray-600 mb-4 text-sm">Upload a photo of your soil. AI will analyze and recommend crops.</p>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-green-300 rounded-xl p-8 cursor-pointer hover:bg-green-50 transition-colors">
          <Upload className="h-10 w-10 text-green-500 mb-2" /><span className="text-green-700 font-medium">Click to upload soil image</span><span className="text-gray-400 text-xs mt-1">JPG, PNG up to 10MB</span>
          <input type="file" accept="image/*" onChange={handleSoilAnalysis} className="hidden" />
        </label>
        {analysisLoading && <div className="mt-4 text-center"><div className="animate-spin h-6 w-6 border-4 border-green-500 border-t-transparent rounded-full mx-auto"></div><p className="text-sm text-gray-500 mt-2">Analyzing...</p></div>}
        {analysisResult && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Analysis Result:</span>
              <button onClick={() => speakText(analysisResult)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                <Volume2 className="h-4 w-4" /> Play Audio
              </button>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">{analysisResult}</div>
          </div>
        )}
      </Modal>)}

      {/* ===== PLANT MODAL ===== */}
      {showPlantModal && (<Modal title="🌿 Plant Disease Detection" onClose={() => { setShowPlantModal(false); setAnalysisResult(''); }}>
        <p className="text-gray-600 mb-4 text-sm">Upload a photo of your plant's affected leaves or stems.</p>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-green-300 rounded-xl p-8 cursor-pointer hover:bg-green-50 transition-colors">
          <Upload className="h-10 w-10 text-green-500 mb-2" /><span className="text-green-700 font-medium">Click to upload plant image</span><span className="text-gray-400 text-xs mt-1">JPG, PNG up to 10MB</span>
          <input type="file" accept="image/*" onChange={handlePlantAnalysis} className="hidden" />
        </label>
        {analysisLoading && <div className="mt-4 text-center"><div className="animate-spin h-6 w-6 border-4 border-green-500 border-t-transparent rounded-full mx-auto"></div><p className="text-sm text-gray-500 mt-2">Analyzing...</p></div>}
        {analysisResult && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Analysis Result:</span>
              <button onClick={() => speakText(analysisResult)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                <Volume2 className="h-4 w-4" /> Play Audio
              </button>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">{analysisResult}</div>
          </div>
        )}
      </Modal>)}

      {/* ===== CROP ADVISORY MODAL ===== */}
      {showCropAdvisory && (<Modal title="🌾 Crop Advisory" onClose={() => { setShowCropAdvisory(false); setCropAdviceResult(''); }}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input type="text" value={cropForm.location} onChange={(e) => setCropForm({ ...cropForm, location: e.target.value })} placeholder="e.g., Punjab, Maharashtra..."
              className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
            <select value={cropForm.season} onChange={(e) => setCropForm({ ...cropForm, season: e.target.value })}
              className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none">
              <option value="Kharif">Kharif (Monsoon - Jun to Oct)</option><option value="Rabi">Rabi (Winter - Nov to Mar)</option><option value="Zaid">Zaid (Summer - Mar to Jun)</option>
            </select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Soil Type (optional)</label>
            <input type="text" value={cropForm.soilType} onChange={(e) => setCropForm({ ...cropForm, soilType: e.target.value })} placeholder="e.g., Clay, Sandy, Loamy..."
              className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" /></div>
          <button onClick={handleCropAdvice} disabled={analysisLoading} className="w-full bg-green-800 hover:bg-green-900 disabled:bg-gray-300 text-white py-3 rounded-lg font-medium">{analysisLoading ? 'Getting advice...' : 'Get Recommendations'}</button>
        </div>
        {cropAdviceResult && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Recommendations:</span>
              <button onClick={() => speakText(cropAdviceResult)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                <Volume2 className="h-4 w-4" /> Play Audio
              </button>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">{cropAdviceResult}</div>
          </div>
        )}
      </Modal>)}

      {/* ===== FINANCIAL MODAL ===== */}
      {showFinancialHelp && (<Modal title="💰 Financial Guidance" onClose={() => { setShowFinancialHelp(false); setFinancialResult(''); }}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Select Topic</label>
            <select value={financialTopic} onChange={(e) => setFinancialTopic(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none">
              <option value="">Select...</option>
              <option value="crop loan KCC">Crop Loan / KCC</option>
              <option value="crop insurance PMFBY">Crop Insurance (PMFBY)</option>
              <option value="PM-KISAN benefits">PM-KISAN Benefits</option>
              <option value="subsidy on farm equipment">Farm Equipment Subsidies</option>
              <option value="organic farming support">Organic Farming Support</option>
              <option value="cold storage warehouse loans">Cold Storage & Warehouse</option>
              <option value="general financial planning">General Planning</option>
            </select></div>
          <button onClick={handleFinancialGuidance} disabled={analysisLoading || !financialTopic} className="w-full bg-green-800 hover:bg-green-900 disabled:bg-gray-300 text-white py-3 rounded-lg font-medium">{analysisLoading ? 'Getting guidance...' : 'Get Financial Guidance'}</button>
        </div>
        {financialResult && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Financial Guidance:</span>
              <button onClick={() => speakText(financialResult)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                <Volume2 className="h-4 w-4" /> Play Audio
              </button>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">{financialResult}</div>
          </div>
        )}
      </Modal>)}

      {/* ===== ALL SCHEMES MODAL ===== */}
      {showSchemesModal && (<Modal title="📋 All Government Schemes" onClose={() => setShowSchemesModal(false)}>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {schemes.map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4 border">
              <h4 className="font-bold text-green-800 text-sm">{s.name}</h4>
              <p className="text-xs text-gray-600 mt-1">{s.description}</p>
              <p className="text-xs font-medium text-orange-600 mt-1">{s.benefits}</p>
              {s.states && !s.states.includes('all') && <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">📍 {s.states.join(', ')}</span>}
              {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-900 mt-2 font-medium"><ExternalLink className="h-3 w-3" />Visit Portal</a>}
            </div>
          ))}
        </div>
      </Modal>)}

      {/* ===== PROFILE MODAL ===== */}
      {showProfileModal && (
        <Modal title="🚜 My Farm Profile" onClose={() => setShowProfileModal(false)}>
          <div className="flex space-x-4 mb-4 border-b">
            <button className={`pb-2 px-2 text-sm font-medium ${activeSection === 'details' ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500'}`} onClick={() => setActiveSection('details')}>Farm Details</button>
            <button className={`pb-2 px-2 text-sm font-medium ${activeSection === 'history' ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500'}`} onClick={() => setActiveSection('history')}>Crop History</button>
          </div>

          {activeSection === 'details' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-700">Land Size</label><input type="text" value={profileData.farmDetails.landSize} onChange={e => setProfileData({ ...profileData, farmDetails: { ...profileData.farmDetails, landSize: e.target.value } })} className="w-full border rounded p-2 text-sm" placeholder="e.g. 5 Acres" /></div>
                <div><label className="text-xs font-bold text-gray-700">Soil Type</label><input type="text" value={profileData.farmDetails.soilType} onChange={e => setProfileData({ ...profileData, farmDetails: { ...profileData.farmDetails, soilType: e.target.value } })} className="w-full border rounded p-2 text-sm" placeholder="e.g. Black" /></div>
                <div><label className="text-xs font-bold text-gray-700">Irrigation</label><input type="text" value={profileData.farmDetails.irrigationSource} onChange={e => setProfileData({ ...profileData, farmDetails: { ...profileData.farmDetails, irrigationSource: e.target.value } })} className="w-full border rounded p-2 text-sm" placeholder="e.g. Tube Well" /></div>
                <div><label className="text-xs font-bold text-gray-700">Farming Type</label><select value={profileData.farmDetails.farmingType} onChange={e => setProfileData({ ...profileData, farmDetails: { ...profileData.farmDetails, farmingType: e.target.value } })} className="w-full border rounded p-2 text-sm"><option>Conventional</option><option>Organic</option><option>Mix</option></select></div>
              </div>
              <button onClick={updateProfile} className="w-full bg-green-700 text-white py-2 rounded-lg font-bold hover:bg-green-800">Save Profile</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-40 overflow-y-auto space-y-2">
                {profileData.cropHistory.length === 0 ? <p className="text-gray-500 text-sm text-center">No history recorded yet.</p> : profileData.cropHistory.map((h, i) => (
                  <div key={i} className="bg-gray-50 p-3 rounded-lg border text-sm flex justify-between">
                    <div><span className="font-bold text-green-800">{h.cropName}</span> <span className="text-gray-500">({h.season} {h.year})</span><div className="text-xs text-gray-600">Yield: {h.yield}</div></div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-bold mb-2">Add New Record</h4>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input type="text" placeholder="Crop Name" className="border rounded p-2 text-xs" value={newCropHistory.cropName} onChange={e => setNewCropHistory({ ...newCropHistory, cropName: e.target.value })} />
                  <input type="text" placeholder="Season" className="border rounded p-2 text-xs" value={newCropHistory.season} onChange={e => setNewCropHistory({ ...newCropHistory, season: e.target.value })} />
                  <input type="number" placeholder="Year" className="border rounded p-2 text-xs" value={newCropHistory.year} onChange={e => setNewCropHistory({ ...newCropHistory, year: e.target.value })} />
                  <input type="text" placeholder="Yield" className="border rounded p-2 text-xs" value={newCropHistory.yield} onChange={e => setNewCropHistory({ ...newCropHistory, yield: e.target.value })} />
                </div>
                <button onClick={addCropHistory} disabled={!newCropHistory.cropName} className="w-full bg-orange-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-orange-700 disabled:opacity-50">Add Record</button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ===== FOOTER ===== */}
      <footer className="bg-green-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:justify-between">
            <div className="mb-8 md:mb-0">
              <div className="flex items-center gap-2"><div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-lg">🌾</div><span className="text-xl font-bold">AgriSense</span></div>
              <p className="mt-3 text-sm text-green-300 max-w-sm">AI-powered agricultural assistant helping Indian farmers with personalized crop advice, weather updates, disease detection, and government scheme information.</p>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div><h3 className="text-sm font-semibold uppercase tracking-wider text-green-400">Features</h3><div className="mt-4 space-y-2">
                <button onClick={() => requireAuth(() => setShowCropAdvisory(true))} className="text-sm text-green-300 hover:text-white block">Crop Advisory</button>
                <button onClick={() => requireAuth(() => setShowPlantModal(true))} className="text-sm text-green-300 hover:text-white block">Disease Detection</button>
                <button onClick={() => requireAuth(() => setShowSoilModal(true))} className="text-sm text-green-300 hover:text-white block">Soil Analysis</button>
                <button onClick={() => requireAuth(() => setShowFinancialHelp(true))} className="text-sm text-green-300 hover:text-white block">Financial Help</button>
              </div></div>
              <div><h3 className="text-sm font-semibold uppercase tracking-wider text-green-400">Resources</h3><div className="mt-4 space-y-2">
                <button onClick={() => setShowSchemesModal(true)} className="text-sm text-green-300 hover:text-white block">Government Schemes</button>
                <button onClick={() => requireAuth(() => setIsChatOpen(true))} className="text-sm text-green-300 hover:text-white block">AI Chat</button>
                <button onClick={() => scrollToSection('weather-section')} className="text-sm text-green-300 hover:text-white block">Weather</button>
              </div></div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-green-800 text-center"><p className="text-sm text-green-400">&copy; 2025 AgriSense. Built for Indian Farmers.</p></div>
        </div>
      </footer>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-800">{title}</h3>
          <button onClick={onClose} className="hover:bg-gray-200 p-1 rounded-full"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}