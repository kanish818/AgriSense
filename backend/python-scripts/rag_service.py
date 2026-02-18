import os
import json
import uuid
import time
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import chromadb
from groq import Groq
import uvicorn
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# 🚀 Models stay loaded in memory for speed!
print("Loading Embedding Model...")
model = SentenceTransformer("all-MiniLM-L6-v2")

print("Connecting to ChromaDB...")
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="farmer_contexts")

groq_api_key = os.getenv("GROQ_API_KEY", "")
groq_client = Groq(api_key=groq_api_key) if groq_api_key else None

class ChatRequest(BaseModel):
    message: str
    language: str = "english"
    farmer_profile: dict = {}

def check_cache(query_text, threshold=0.3):
    """
    Checks if a similar question exists in ChromaDB.
    Threshold 0.3 implies ~85-90% similarity.
    Returns: (is_match, cached_answer)
    """
    try:
        query_embedding = model.encode(query_text).tolist()
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=1
        )
        
        if not results['documents'] or not results['distances']:
            return False, None

        distance = results['distances'][0][0]
        
        # If distance is low (very similar), return the cached answer
        if distance < threshold:
            # Metadata contains the pure answer
            metadata = results['metadatas'][0][0]
            cached_answer = metadata.get('answer')
            if cached_answer:
                return True, cached_answer
                
        return False, None
    except Exception as e:
        print(f"Cache check error: {e}")
        return False, None

def save_to_memory(question, answer, farmer_profile):
    """Background Task: Saves Q&A to ChromaDB for future caching"""
    try:
        # We store the Question as the document for semantic search
        # We store the Answer in metadata for retrieval
        doc_id = str(uuid.uuid4())
        
        embedding = model.encode(question).tolist()
        
        collection.add(
            documents=[question],
            embeddings=[embedding],
            metadatas=[{
                "type": "interaction", 
                "answer": answer, # Store answer here!
                "farmer_id": farmer_profile.get("id", "unknown"),
                "location": farmer_profile.get("location", "unknown")
            }],
            ids=[doc_id]
        )
        print(f"✅ [Memory] Saved Q&A: {question[:30]}...")
    except Exception as e:
        print(f"⚠️ Error saving to memory: {e}")

@app.post("/chat")
async def chat(request: ChatRequest, background_tasks: BackgroundTasks):
    start_time = time.time()
    
    if not groq_client:
        raise HTTPException(status_code=500, detail="Groq API key not configured")

    # 1. SMART CACHE CHECK (Fastest)
    is_match, cached_response = check_cache(request.message)
    
    if is_match:
        print(f"⚡ Cache Hit! Returned stored answer in {time.time() - start_time:.2f}s")
        return {
            "response": cached_response,
            "contexts_used": 1,
            "source": "cache"
        }

    # 2. GENERATE NEW ANSWER (Fast - No RAG retrieval overhead)
    # We skip searching old contexts to speed up the process as requested.
    
    lang_map = {"english": "English", "hindi": "Hindi", "punjabi": "Punjabi"}
    target_lang = lang_map.get(request.language, "English")
    
    profile = request.farmer_profile
    profile_str = f"Name: {profile.get('name', 'Farmer')}, Location: {profile.get('location', 'India')}, Crops: {', '.join(profile.get('crops', []))}"

    system_prompt = (
        f"You are AgriSense, an expert agricultural AI assistant. "
        f"Answer the user's question directly in {target_lang}. "
        f"Keep your answer practical, concise (max 2-3 sentences), and helpful."
    )

    user_prompt = (
        f"FARMER PROFILE: {profile_str}\n\n"
        f"QUESTION: {request.message}\n\n"
        f"ANSWER:"
    )

    try:
        completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.6,
            max_tokens=300
        )
        
        answer = completion.choices[0].message.content
        
        # 3. MEMORY: Save for future cache (Background)
        background_tasks.add_task(save_to_memory, request.message, answer, request.farmer_profile)
        
        print(f"⚡ AI Generated in {time.time() - start_time:.2f}s")
        
        return {
            "response": answer,
            "contexts_used": 0,
            "source": "ai"
        }
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
