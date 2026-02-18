import sys
import json
import os
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
from groq import Groq

# Initialize embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Initialize ChromaDB
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="farmer_contexts")

# Initialize Groq client
groq_api_key = os.getenv("GROQ_API_KEY", "")
groq_client = Groq(api_key=groq_api_key) if groq_api_key else None


def retrieve_similar_contexts(query_text, n_results=5):
    """Retrieve top-N similar farmer contexts from ChromaDB"""
    try:
        query_embedding = model.encode(query_text).tolist()
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )
        
        if results and results['documents']:
            return results['documents'][0]  # Returns list of similar documents
        return []
    except Exception as e:
        print(f"Retrieval error: {e}", file=sys.stderr)
        return []


def generate_answer(question, farmer_profile, retrieved_contexts, language):
    """Generate answer using Groq with RAG context"""
    
    if not groq_client:
        return "Error: Groq API key not configured"
    
    # Language mapping
    lang_map = {
        "english": "English",
        "hindi": "Hindi", 
        "punjabi": "Punjabi"
    }
    target_lang = lang_map.get(language, "English")
    
    # Build context from retrieved documents
    context_text = ""
    if retrieved_contexts:
        context_text = "\n\nRelevant farmer contexts and past queries:\n"
        for idx, ctx in enumerate(retrieved_contexts[:3], 1):
            context_text += f"{idx}. {ctx}\n"
    
    # Build farmer profile context
    profile_text = ""
    if farmer_profile:
        profile_text = f"\n\nCurrent farmer profile:\n"
        profile_text += f"Name: {farmer_profile.get('name', 'Unknown')}\n"
        profile_text += f"Location: {farmer_profile.get('location', 'Unknown')}\n"
        profile_text += f"Crops: {', '.join(farmer_profile.get('crops', []))}\n"
        profile_text += f"Land: {farmer_profile.get('land_size', 'Unknown')}\n"
        profile_text += f"Soil: {farmer_profile.get('soil_type', 'Unknown')}\n"
        profile_text += f"Irrigation: {farmer_profile.get('irrigation', 'Unknown')}\n"
        if farmer_profile.get('challenges'):
            profile_text += f"Known challenges: {farmer_profile.get('challenges')}\n"
    
    # System prompt
    system_prompt = f"""You are AgriSense, an expert agricultural AI assistant for Indian farmers.
You provide personalized, practical advice based on the farmer's profile and similar past queries.

Respond entirely in {target_lang}.

Guidelines:
- Be specific and actionable
- Consider local conditions (soil, climate, crops)
- Reference government schemes when relevant
- Provide step-by-step guidance
- Use simple, farmer-friendly language"""
    
    # User prompt with RAG context
    user_prompt = f"""{profile_text}{context_text}

Farmer's Question: {question}

Provide a detailed, helpful answer in {target_lang}."""
    
    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=1024,
        )
        
        return chat_completion.choices[0].message.content
    
    except Exception as e:
        print(f"Groq API error: {e}", file=sys.stderr)
        return f"Error generating response: {str(e)}"


def main():
    try:
        # Read input from command line arguments
        if len(sys.argv) < 2:
            print(json.dumps({"error": "Missing arguments"}))
            sys.exit(1)
        
        input_data = json.loads(sys.argv[1])
        
        question = input_data.get("message", "")
        language = input_data.get("language", "english")
        farmer_profile = input_data.get("farmer_profile", {})
        
        if not question:
            print(json.dumps({"error": "No question provided"}))
            sys.exit(1)
        
        # Step 1: Retrieve similar contexts from ChromaDB
        retrieved_contexts = retrieve_similar_contexts(question, n_results=5)
        
        # Step 2: Generate answer with RAG
        answer = generate_answer(question, farmer_profile, retrieved_contexts, language)
        
        # Step 3: Return response
        response = {
            "response": answer,
            "contexts_used": len(retrieved_contexts),
            "audio": None  # TTS handled by frontend
        }
        
        print(json.dumps(response))
        sys.exit(0)
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
