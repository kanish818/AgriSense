"""
Test script for RAG chatbot
"""
import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

def test_rag_chatbot():
    """Test the RAG chatbot with sample queries"""
    
    test_cases = [
        {
            "message": "What crops should I grow in Punjab during winter?",
            "language": "english",
            "farmer_profile": {
                "id": "test_001",
                "name": "Test Farmer",
                "location": "Punjab",
                "crops": ["Wheat", "Rice"],
                "language": "english"
            }
        },
        {
            "message": "कपास में कीट नियंत्रण कैसे करें?",
            "language": "hindi",
            "farmer_profile": {
                "id": "test_002",
                "name": "Test Farmer",
                "location": "Gujarat",
                "crops": ["Cotton"],
                "language": "hindi"
            }
        }
    ]
    
    print("=" * 60)
    print("RAG CHATBOT TEST")
    print("=" * 60)
    
    for idx, test_case in enumerate(test_cases, 1):
        print(f"\n\nTest Case {idx}:")
        print(f"Question: {test_case['message']}")
        print(f"Language: {test_case['language']}")
        print(f"Location: {test_case['farmer_profile']['location']}")
        print("-" * 60)
        
        # Import and run chatbot
        try:
            from rag_chatbot import retrieve_similar_contexts, generate_answer
            
            # Retrieve contexts
            contexts = retrieve_similar_contexts(test_case['message'], n_results=3)
            print(f"\nRetrieved {len(contexts)} similar contexts:")
            for i, ctx in enumerate(contexts[:2], 1):
                print(f"  {i}. {ctx[:100]}...")
            
            # Generate answer
            answer = generate_answer(
                test_case['message'],
                test_case['farmer_profile'],
                contexts,
                test_case['language']
            )
            
            print(f"\nAnswer:\n{answer}")
            print("\n" + "=" * 60)
            
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_rag_chatbot()
