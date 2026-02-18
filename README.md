# 🌾 AgriSense — AI-Powered Smart Farming Assistant

![AgriSense Banner](https://img.shields.io/badge/AgriSense-Smart%20Farming-2ea44f?style=for-the-badge&logo=leaf)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Groq AI](https://img.shields.io/badge/AI-Groq%20Llama%203-f55036?style=flat-square&logo=openai&logoColor=white)](https://groq.com/)
[![RAG](https://img.shields.io/badge/Memory-RAG%20%2B%20ChromaDB-blue?style=flat-square&logo=python)](https://www.trychroma.com/)

> **Empowering Indian Farmers with AI, Voice Support, and Instant Expert Advice.**

---

## 📸 Project Showcase

### 🖥️ **Smart Dashboard**
![Dashboard](assets/dashboard.png)
*Get weather, quick features, and government schemes in one glance.*

### 🤖 **AI Chat Interface**
![Chat Interface](assets/chat.png)
*Ask farming questions in Hindi, Punjabi, or English with Voice Support.*

### 📋 **Government Schemes**
![Schemes Interface](assets/schemes.png)
*Browse and apply for relevant government schemes directly.*

---

## 🌟 Key Features

### 🤖 **AI-Powered Agri-Chatbot**
- **Instant Answers:** Powered by **Groq (Llama-3-8b)** for sub-second responses.
- **RAG Memory:** Remembers context from previous conversations (Persistent Memory via MongoDB).
- **Multilingual & Voice:** Supports **Hindi, Punjabi, and English** with full voice input/output.

### 🔬 **Smart Diagnosis Tools**
- **Leaf Disease Detection:** Upload a photo of a sick plant, and AI identifies the disease + remedy.
- **Soil Analysis:** AI analyzes soil images to recommend the best crops for your land.

### 🚜 **Farm Management Profile**
- **"My Farm" Dashboard:** Store details about your land size, soil type, and irrigation.
- **Crop History:** Track past yields and performance (Database stored).
- **Personalized Advice:** AI gives advice specific to *your* farm details.

### 🏛️ **Government Schemes**
- **Curated List:** Access the latest schemes like PM-KISAN, KCC, and more.
- **Easy Apply:** Direct links and simplified explanations.

---

## 🛠️ Tech Stack

- **Frontend:** React.js, Tailwind CSS, Lucide Icons, Vite
- **Backend:** Node.js, Express.js, JWT Auth
- **AI & ML:** Python, Groq SDK, Sentence Transformers, ChromaDB (Vector Store)
- **Database:** MongoDB Atlas (Cloud)
- **Deployment:** Vercel (Frontend) + Render (Backend)

---

## 🚀 deployment

This project is deployed using a cost-effective, high-performance architecture:

1.  **Frontend:** Hosted on [Vercel](https://vercel.com).
2.  **Backend:** Hosted on [Render](https://render.com).
3.  **Database:** [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
4.  **AI Engine:** Direct integration with [Groq Cloud](https://groq.com).

---

## 🏃‍♂️ How to Run Locally

1.  **Clone the Repo**
    ```bash
    git clone https://github.com/kanish818/AgriSense.git
    cd AgriSense
    ```

2.  **Setup Backend**
    ```bash
    cd backend
    npm install
    # Setup .env file with GROQ_API_KEY and MONGO_URI
    npm start
    ```

3.  **Setup Frontend**
    ```bash
    cd frontend
    npm install
    # Setup .env with VITE_BACKEND_URL=http://localhost:5000
    npm run dev
    ```

---

## 🤝 Contributing
Contributions are welcome! Pull requests are encouraged. 

Made with ❤️ for **Farmers of India**.
