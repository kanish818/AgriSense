# 🚀 AgriSense Deployment Guide + Persistent RAG Memory

This guide details exactly how to deploy AgriSense (formerly FarmSaathi) so that your chat history is **PERMANENT**, even when hosted on free tiers like Render.

## 🧠 Why Render "Forgets" (And How We Fixed It)

**The Problem:** Render's free tier spins down (sleeps) after inactivity. When it wakes up, any local variables or files are deleted. This causes "Amnesia."

**The Solution:** We have connected the backend to **MongoDB Atlas**. 
1. **The Brain (Render):** Stateless logic. It forgets everything on restart.
2. **The Memory (MongoDB):** Persistent storage. It remembers everything forever.

**Our RAG Workflow:**
1.  **User Asks:** "What crop did we discuss last week?"
2.  **Backend Checks DB:** Queries `db.chats.find({ userId: ... })` from MongoDB.
3.  **Inject Context:** Sends the past conversation + new question to Groq AI.
4.  **AI Responds:** "We discussed wheat farming in Black Soil."

---

## 🌍 Phase 1: Deploy Backend (Render)

1.  **Push Code to GitHub:** Ensure your latest changes (including `backend/` and `AgriSense-main/`) are on GitHub.
2.  **Go to [Render Dashboard](https://dashboard.render.com/)** -> **New +** -> **Web Service**.
3.  **Connect GitHub:** Select your `AgriSense` repository.
4.  **Configure Service:**
    -   **Name:** `agrisense-backend`
    -   **Region:** Singapore (closest to India).
    -   **Root Directory:** `backend` (CRITICAL STEP!).
    -   **Runtime:** Node.js
    -   **Build Command:** `./render-build.sh` (or `npm install && pip install -r requirements.txt`)
    -   **Start Command:** `node server.js`
    -   **Plan:** Free

5.  **Environment Variables (Env Vars):**
    *Scroll down and add these keys:*
    -   `GROQ_API_KEY`: `your_groq_api_key`
    -   `MONGO_URI`: `your_mongodb_connection_string`
    -   `JWT_SECRET`: `your_secret_key`
    -   `PORT`: `10000`

6.  **Deploy:** Click **Create Web Service**. Wait for the green "Live" badge.
    -   *Copy your Backend URL:* `https://agrisense-backend.onrender.com`

---

## 🌐 Phase 2: Deploy Frontend (Vercel)

1.  **Go to [Vercel Dashboard](https://vercel.com/dashboard)** -> **Add New...** -> **Project**.
2.  **Import Git Repository:** Select `AgriSense`.
3.  **Project Settings:**
    -   **Framework Preset:** Vite
    -   **Root Directory:** Click "Edit" -> Select `frontend` folder.
4.  **Environment Variables:**
    -   `VITE_BACKEND_URL`: `https://agrisense-backend.onrender.com` (Your Render URL).
    -   *Note: No trailing slash `/` at the end.*
5.  **Deploy:** Click **Deploy**.

---

## ✅ Verification Checklist

1.  **Open your Vercel URL** (e.g., `agrisense.vercel.app`).
2.  **Login/Signup**.
3.  **Chat Test:**
    -   Say: "My farm has Black Soil."
    -   Wait 15 mins (or redeploy backend to force restart).
    -   Say: "What soil do I have?"
    -   **Result:** It should say "You have Black Soil." (Retrieved from MongoDB).

---

## 📁 Project Structure (After Renaming)

-   `backend/` - Node.js Server + Python RAG Scripts
-   `frontend/` - React UI (Vite)
-   `AgriSense-main/` - Core AI Models and Notebooks
-   `assets/` - Project Screenshots
