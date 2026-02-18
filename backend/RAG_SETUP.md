# RAG Chatbot Setup and Usage

## Overview
The AgriSense RAG (Retrieval-Augmented Generation) chatbot uses ChromaDB to store and retrieve relevant farmer contexts, then generates personalized responses using the Groq LLM API.

## Architecture

```
User Question → Backend → Python RAG Script → ChromaDB (Retrieve) → Groq LLM (Generate) → Response
```

### Components:

1. **ChromaDB**: Vector database storing farmer profiles and agricultural contexts
2. **SentenceTransformer**: Generates embeddings for semantic search
3. **Groq API**: LLM for generating contextual responses
4. **Node.js Backend**: Orchestrates the RAG pipeline

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd backend
pip install -r python-scripts/requirements.txt
```

This installs:
- `sentence-transformers`: For generating embeddings
- `chromadb`: Vector database
- `groq`: Groq API client
- `numpy`: Required dependency

### 2. Populate ChromaDB

```bash
cd backend
python python-scripts/populate_chroma.py
```

This will:
- Load farmer data from `data/farmers.json`
- Generate embeddings for each farmer profile
- Create multiple documents per farmer (profile, challenges, queries)
- Store in ChromaDB at `backend/chroma_db/`

Expected output:
```
Loading farmer data...
Processing 5 farmers...
Generating embeddings for 20 documents...
Adding to ChromaDB...
✅ Successfully added 20 documents to ChromaDB
```

### 3. Verify Setup

Test the RAG chatbot directly:

```bash
cd backend
python python-scripts/rag_chatbot.py '{"message":"What crops should I grow in Punjab?","language":"english","farmer_profile":{}}'
```

## How It Works

### 1. User sends a question
```javascript
POST /api/chat
{
  "message": "How to control pests in cotton?",
  "language": "hindi"
}
```

### 2. Backend retrieves user profile
- Fetches user data from MongoDB
- Extracts: name, location, crops, language

### 3. Python RAG script executes
```python
# Generate query embedding
query_embedding = model.encode(question)

# Retrieve top-5 similar contexts from ChromaDB
results = collection.query(
    query_embeddings=[query_embedding],
    n_results=5
)

# Build augmented prompt with:
# - System role (agricultural expert)
# - User profile
# - Retrieved contexts
# - Original question

# Generate answer using Groq
response = groq_client.chat.completions.create(...)
```

### 4. Response returned to frontend
```json
{
  "response": "कपास में कीटों को नियंत्रित करने के लिए...",
  "contexts_used": 5,
  "audio": null
}
```

### 5. Frontend displays and speaks response
- Text displayed in chat
- TTS automatically speaks in selected language

## File Structure

```
backend/
├── python-scripts/
│   ├── rag_chatbot.py          # Main RAG chatbot
│   ├── populate_chroma.py      # Populate ChromaDB
│   └── requirements.txt        # Python dependencies
├── data/
│   └── farmers.json            # Sample farmer profiles
├── chroma_db/                  # ChromaDB storage (auto-created)
└── controllers/
    └── chatControllers.js      # Node.js chat handler
```

## Adding New Farmer Data

1. Edit `backend/data/farmers.json`
2. Add new farmer object:
```json
{
  "id": "farmer_006",
  "name": "New Farmer",
  "location": "State",
  "crops": ["Crop1", "Crop2"],
  "land_size": "X acres",
  "soil_type": "Type",
  "irrigation": "Method",
  "challenges": "Challenges faced",
  "previous_queries": ["Query 1", "Query 2"]
}
```
3. Re-run: `python python-scripts/populate_chroma.py`

## Customization

### Change Embedding Model
Edit `rag_chatbot.py` and `populate_chroma.py`:
```python
model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")  # Better for Hindi/Punjabi
```

### Adjust Retrieval Count
Edit `rag_chatbot.py`:
```python
retrieved_contexts = retrieve_similar_contexts(question, n_results=10)  # More context
```

### Change LLM Model
Edit `rag_chatbot.py`:
```python
model="llama-3.1-70b-versatile"  # Different Groq model
```

## Troubleshooting

### "ChromaDB collection empty"
Run: `python python-scripts/populate_chroma.py`

### "Groq API error"
Check `.env` file has valid `GROQ_API_KEY`

### "Python not found"
Ensure Python 3.8+ is installed and in PATH

### "Module not found"
Re-run: `pip install -r python-scripts/requirements.txt`

## Performance

- **Embedding generation**: ~50ms per query
- **ChromaDB retrieval**: ~20ms for top-5 results
- **Groq LLM generation**: ~500-1500ms
- **Total latency**: ~600-1600ms per chat message

## Multi-Language Support

The RAG system supports:
- **English** (`en-IN`)
- **Hindi** (`hi-IN`)
- **Punjabi** (`pa-IN`)

Responses are generated in the requested language, and the frontend TTS speaks them accordingly.
