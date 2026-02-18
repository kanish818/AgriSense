import sys
import json
from sentence_transformers import SentenceTransformer
import chromadb
import uuid

try:
    # Load model
    model = SentenceTransformer("all-MiniLM-L6-v2")
    
    # Connect to ChromaDB
    chroma_client = chromadb.PersistentClient(path="./chroma_db")
    collection = chroma_client.get_or_create_collection(name="farmer_contexts")
    
    # Parse input
    data = json.loads(sys.argv[1])
    question = data.get("message", "")
    answer = data.get("answer", "")
    farmer_profile = data.get("farmer_profile", {})
    
    if question and answer:
        # Generate embedding from question
        embedding = model.encode(question).tolist()
        
        # Save to ChromaDB
        doc_id = str(uuid.uuid4())
        collection.add(
            documents=[question],
            embeddings=[embedding],
            metadatas=[{
                "type": "interaction",
                "answer": answer,
                "farmer_id": farmer_profile.get("id", "unknown"),
                "location": farmer_profile.get("location", "unknown")
            }],
            ids=[doc_id]
        )
        print(f"Saved to RAG: {question[:50]}...")
        
except Exception as e:
    # Silent fail - don't block the main response
    print(f"RAG save error: {e}", file=sys.stderr)
    pass
