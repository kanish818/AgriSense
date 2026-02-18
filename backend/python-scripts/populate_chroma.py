import json
import os
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings

# Initialize embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Initialize ChromaDB
chroma_client = chromadb.PersistentClient(path="./chroma_db")

# Get or create collection
collection = chroma_client.get_or_create_collection(
    name="farmer_contexts",
    metadata={"description": "Farmer profiles and agricultural contexts"}
)

def load_farmer_data():
    """Load farmer data from JSON file"""
    farmers_file = os.path.join(os.path.dirname(__file__), "..", "data", "farmers.json")
    with open(farmers_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def create_farmer_documents(farmer):
    """Create multiple documents from a single farmer profile for better retrieval"""
    documents = []
    metadatas = []
    ids = []
    
    farmer_id = farmer['id']
    
    # Document 1: Basic profile
    profile_doc = f"""Farmer: {farmer['name']}
Location: {farmer['location']}
Crops: {', '.join(farmer['crops'])}
Land size: {farmer['land_size']}
Soil type: {farmer['soil_type']}
Irrigation: {farmer['irrigation']}"""
    
    documents.append(profile_doc)
    metadatas.append({"type": "profile", "farmer_id": farmer_id, "location": farmer['location']})
    ids.append(f"{farmer_id}_profile")
    
    # Document 2: Challenges and context
    if farmer.get('challenges'):
        challenge_doc = f"""Farmer from {farmer['location']} growing {', '.join(farmer['crops'])}.
Challenges: {farmer['challenges']}
Soil: {farmer['soil_type']}, Irrigation: {farmer['irrigation']}"""
        
        documents.append(challenge_doc)
        metadatas.append({"type": "challenges", "farmer_id": farmer_id, "location": farmer['location']})
        ids.append(f"{farmer_id}_challenges")
    
    # Document 3-N: Previous queries (each as separate document for better matching)
    for idx, query in enumerate(farmer.get('previous_queries', [])):
        query_doc = f"""Question from {farmer['location']} farmer growing {', '.join(farmer['crops'])}: {query}
Context: {farmer['soil_type']} soil, {farmer['land_size']} land"""
        
        documents.append(query_doc)
        metadatas.append({"type": "query", "farmer_id": farmer_id, "location": farmer['location']})
        ids.append(f"{farmer_id}_query_{idx}")
    
    return documents, metadatas, ids


def populate_chromadb():
    """Populate ChromaDB with farmer data"""
    print("Loading farmer data...")
    farmers = load_farmer_data()
    
    all_documents = []
    all_metadatas = []
    all_ids = []
    
    print(f"Processing {len(farmers)} farmers...")
    
    for farmer in farmers:
        docs, metas, doc_ids = create_farmer_documents(farmer)
        all_documents.extend(docs)
        all_metadatas.extend(metas)
        all_ids.extend(doc_ids)
    
    print(f"Generating embeddings for {len(all_documents)} documents...")
    embeddings = model.encode(all_documents).tolist()
    
    print("Adding to ChromaDB...")
    collection.add(
        documents=all_documents,
        embeddings=embeddings,
        metadatas=all_metadatas,
        ids=all_ids
    )
    
    print(f"✅ Successfully added {len(all_documents)} documents to ChromaDB")
    print(f"   - {len(farmers)} farmer profiles")
    print(f"   - Multiple context documents per farmer")
    
    # Verify
    count = collection.count()
    print(f"\nTotal documents in collection: {count}")


if __name__ == "__main__":
    try:
        populate_chromadb()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
