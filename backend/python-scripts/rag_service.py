import hashlib
import os
import re
import time
from collections import OrderedDict
from pathlib import Path
from typing import Any, Dict, List, Optional

import chromadb
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from groq import Groq
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
CHROMA_PATH = str(BASE_DIR / "chroma_db")
EMBEDDING_MODEL_NAME = os.getenv("RAG_EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
GROQ_MODEL_NAME = os.getenv("RAG_GROQ_MODEL", "llama-3.3-70b-versatile")
RAG_SERVICE_PORT = int(os.getenv("RAG_SERVICE_PORT", "8000"))

app = FastAPI(title="AgriSense Pure RAG Service")

print(f"Loading embedding model: {EMBEDDING_MODEL_NAME}")
embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)

print(f"Connecting to ChromaDB at {CHROMA_PATH}")
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

kb_authoritative = chroma_client.get_or_create_collection(
    name="kb_authoritative",
    metadata={"description": "Curated authoritative agriculture knowledge"},
)
kb_qa_curated = chroma_client.get_or_create_collection(
    name="kb_qa_curated",
    metadata={"description": "Curated agriculture QA pairs"},
)
user_memory = chroma_client.get_or_create_collection(
    name="user_memory",
    metadata={"description": "Per-user chat memory and profile snippets"},
)

groq_api_key = os.getenv("GROQ_API_KEY", "")
groq_client = Groq(api_key=groq_api_key) if groq_api_key else None

query_embedding_cache: "OrderedDict[str, List[float]]" = OrderedDict()
answer_cache: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")
TERM_EXPANSIONS = {
    "रोग": "disease plant disease infection",
    "ਬਿਮਾਰੀ": "disease plant disease infection",
    "कीट": "pest insect infestation",
    "ਕੀੜ": "pest insect infestation",
    "खाद": "fertilizer nutrient urea dap potash",
    "ਮਿੱਟੀ": "soil fertility soil health",
    "सिंचाई": "irrigation water drip sprinkler",
    "ਸਿੰਚਾਈ": "irrigation water drip sprinkler",
    "योजना": "scheme subsidy government scheme",
    "ਸਕੀਮ": "scheme subsidy government scheme",
    "ऋण": "loan credit finance",
    "ਕਰਜ਼": "loan credit finance",
    "गेहूं": "wheat",
    "ਗੰਹੂ": "wheat",
    "धान": "rice paddy",
    "ਚਾਵਲ": "rice paddy",
    "कपास": "cotton",
    "ਕਪਾਹ": "cotton",
    "सरसों": "mustard",
    "ਸਰੋਂ": "mustard",
    "मक्का": "maize corn",
    "ਮੱਕੀ": "maize corn",
    "आलू": "potato",
    "ਆਲੂ": "potato",
    "गन्ना": "sugarcane",
    "ਗੰਨਾ": "sugarcane",
}


class ChatRequest(BaseModel):
    message: str
    language: str = "english"
    farmer_profile: dict = Field(default_factory=dict)
    history_context: list = Field(default_factory=list)
    timeout_ms: int = 5000


class MemoryRequest(BaseModel):
    message: str
    answer: str
    farmer_profile: dict = Field(default_factory=dict)


class AdminRequest(BaseModel):
    admin_key: str


def get_collection(name: str, description: str):
    return chroma_client.get_or_create_collection(name=name, metadata={"description": description})


def resolve_collection(name: str):
    mapping = {
        "kb_authoritative": kb_authoritative,
        "kb_qa_curated": kb_qa_curated,
        "user_memory": user_memory,
    }
    return mapping[name]


def reload_collections() -> None:
    global kb_authoritative, kb_qa_curated, user_memory
    kb_authoritative = get_collection("kb_authoritative", "Curated authoritative agriculture knowledge")
    kb_qa_curated = get_collection("kb_qa_curated", "Curated agriculture QA pairs")
    user_memory = get_collection("user_memory", "Per-user chat memory and profile snippets")
    query_embedding_cache.clear()
    answer_cache.clear()


def safe_collection_count(name: str) -> int:
    try:
        return resolve_collection(name).count()
    except Exception:
        reload_collections()
        return resolve_collection(name).count()


def bounded_cache_put(cache: OrderedDict, key: str, value: Any, max_items: int) -> None:
    cache[key] = value
    cache.move_to_end(key)
    while len(cache) > max_items:
        cache.popitem(last=False)


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def safe_text_hash(parts: List[str]) -> str:
    digest = hashlib.sha256("||".join(parts).encode("utf-8")).hexdigest()
    return digest[:32]


def get_query_embedding(text: str) -> List[float]:
    normalized = normalize_text(text)
    if normalized in query_embedding_cache:
        query_embedding_cache.move_to_end(normalized)
        return query_embedding_cache[normalized]

    embedding = embedding_model.encode(text).tolist()
    bounded_cache_put(query_embedding_cache, normalized, embedding, 512)
    return embedding


def tokenize(text: str) -> set:
    return set(re.findall(r"[\w-]+", normalize_text(text)))


def expand_query_text(text: str) -> str:
    additions = []
    for term, expansion in TERM_EXPANSIONS.items():
        if term in (text or ""):
            additions.append(expansion)
    if not additions:
        return text
    return f"{text} {' '.join(additions)}"


def detect_query_language(text: str, fallback: str = "english") -> str:
    if re.search(r"[\u0A00-\u0A7F]", text or ""):
        return "punjabi"
    if re.search(r"[\u0900-\u097F]", text or ""):
        return "hindi"
    return fallback


def infer_topic_hints(text: str) -> set:
    normalized = normalize_text(expand_query_text(text))
    hints = set()
    if any(keyword in normalized for keyword in ["disease", "fungus", "rust", "blight", "रोग", "ਬਿਮਾਰੀ"]):
        hints.add("disease_management")
    if any(keyword in normalized for keyword in ["pest", "insect", "bollworm", "aphid", "कीट", "ਕੀੜ"]):
        hints.add("pest_management")
    if any(keyword in normalized for keyword in ["fertilizer", "nutrient", "soil", "खाद", "ਮਿੱਟੀ"]):
        hints.add("soil_fertility")
    if any(keyword in normalized for keyword in ["scheme", "subsidy", "insurance", "loan", "योजना", "ਸਕੀਮ"]):
        hints.add("government_scheme")
    if any(keyword in normalized for keyword in ["irrigation", "drip", "sprinkler", "सिंचाई", "ਸਿੰਚਾਈ"]):
        hints.add("irrigation")
    return hints


def query_collection(collection_name: str, query_embedding: List[float], n_results: int, where: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    collection = resolve_collection(collection_name)
    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where,
        )
    except Exception:
        reload_collections()
        results = resolve_collection(collection_name).query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where,
        )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]
    ids = results.get("ids", [[]])[0]

    hits = []
    for document, metadata, distance, doc_id in zip(documents, metadatas, distances, ids):
        hits.append(
            {
                "id": doc_id,
                "document": document,
                "metadata": metadata or {},
                "distance": float(distance),
            }
        )
    return hits


def rerank_candidates(question: str, candidates: List[Dict[str, Any]], farmer_profile: Dict[str, Any], preferred_language: str, top_n: int = 3) -> List[Dict[str, Any]]:
    expanded_question = expand_query_text(question)
    question_tokens = tokenize(expanded_question)
    crop_names = {normalize_text(crop) for crop in farmer_profile.get("crops", []) if crop}
    topic_hints = infer_topic_hints(question)
    ranked = []

    for candidate in candidates:
        metadata = candidate.get("metadata", {})
        doc_tokens = tokenize(candidate["document"])
        overlap = len(question_tokens & doc_tokens)
        semantic_score = 1 / (1 + max(candidate.get("distance", 0.0), 0.0))
        crop_bonus = 0.12 if normalize_text(str(metadata.get("crop", ""))) in crop_names else 0.0
        verified_bonus = 0.08 if metadata.get("verified") else 0.0
        metadata_language = normalize_text(str(metadata.get("language", "english")))
        if metadata_language == preferred_language:
            language_bonus = 0.18
        elif metadata_language in {"multilingual", "mixed"}:
            language_bonus = 0.12
        elif metadata_language == "english":
            language_bonus = 0.06
        else:
            language_bonus = 0.0

        topic_bonus = 0.14 if metadata.get("topic") in topic_hints else 0.0
        score = semantic_score + (overlap * 0.03) + crop_bonus + verified_bonus + language_bonus + topic_bonus
        ranked.append({**candidate, "score": score})

    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked[:top_n]


def build_grounded_context(chunks: List[Dict[str, Any]]) -> str:
    lines = []
    for index, chunk in enumerate(chunks, start=1):
        metadata = chunk.get("metadata", {})
        source = metadata.get("source", "unknown_source")
        topic = metadata.get("topic", "general")
        crop = metadata.get("crop", "general")
        lines.append(
            f"[{index}] source={source}; topic={topic}; crop={crop}\n{chunk['document']}"
        )
    return "\n\n".join(lines)


def localized_insufficient_context(language: str) -> str:
    messages = {
        "english": "I do not have enough reliable retrieved information yet to answer that confidently. Please ask a narrower farming question or rebuild the knowledge base with more crop- and region-specific material.",
        "hindi": "मेरे पास अभी इतना विश्वसनीय प्राप्त ज्ञान नहीं है कि मैं भरोसे से उत्तर दे सकूं। कृपया थोड़ा संकीर्ण कृषि प्रश्न पूछें या ज्ञान आधार में अधिक फसल और क्षेत्र आधारित सामग्री जोड़ें।",
        "punjabi": "ਮੇਰੇ ਕੋਲ ਇਸ ਵੇਲੇ ਇੰਨੀ ਭਰੋਸੇਯੋਗ ਪ੍ਰਾਪਤ ਜਾਣਕਾਰੀ ਨਹੀਂ ਹੈ ਕਿ ਮੈਂ ਯਕੀਨ ਨਾਲ ਜਵਾਬ ਦੇ ਸਕਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਹੋਰ ਖਾਸ ਖੇਤੀ ਸਬੰਧੀ ਸਵਾਲ ਪੁੱਛੋ ਜਾਂ ਗਿਆਨ ਭੰਡਾਰ ਵਿੱਚ ਹੋਰ ਫਸਲ ਅਤੇ ਖੇਤਰ ਅਧਾਰਿਤ ਜਾਣਕਾਰੀ ਜੋੜੋ।",
    }
    return messages.get(language, messages["english"])


def generate_grounded_answer(question: str, language: str, farmer_profile: Dict[str, Any], chunks: List[Dict[str, Any]]) -> str:
    if not chunks:
        return localized_insufficient_context(language)

    if not groq_client:
        return localized_insufficient_context(language)

    lang_map = {"english": "English", "hindi": "Hindi", "punjabi": "Punjabi"}
    target_lang = lang_map.get(language, "English")

    profile = farmer_profile or {}
    details = profile.get("details", {})
    profile_context = "\n".join(
        [
            f"Location: {profile.get('location', 'India')}",
            f"Crops: {', '.join(profile.get('crops', [])) or 'Not specified'}",
            f"Soil Type: {details.get('soilType', 'Unknown')}",
            f"Irrigation: {details.get('irrigationSource', 'Unknown')}",
        ]
    )

    grounded_context = build_grounded_context(chunks)

    system_prompt = (
        f"You are AgriSense, an agricultural assistant for Indian farmers. "
        f"Answer only using the retrieved evidence. If the evidence is insufficient, say so plainly. "
        f"Respond entirely in {target_lang}. Keep the answer practical and concise."
    )

    user_prompt = f"""Farmer profile:
{profile_context}

Retrieved evidence:
{grounded_context}

Question:
{question}

Instructions:
- Use only the retrieved evidence.
- Do not invent facts.
- If evidence is insufficient, say that clearly.
- Answer entirely in {target_lang}.
"""

    completion = groq_client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        model=GROQ_MODEL_NAME,
        temperature=0.2,
        max_tokens=700,
    )

    return completion.choices[0].message.content


def retrieve_contexts(question: str, question_language: str, farmer_profile: Dict[str, Any], timeout_ms: int) -> Dict[str, Any]:
    started_at = time.time()
    expanded_question = expand_query_text(question)
    query_embedding = get_query_embedding(expanded_question)
    candidates: List[Dict[str, Any]] = []
    preferred_language = detect_query_language(question, fallback=question_language)

    candidates.extend(query_collection("kb_authoritative", query_embedding, n_results=6))
    retrieval_ms = int((time.time() - started_at) * 1000)
    if retrieval_ms > timeout_ms:
        return {"timed_out": True, "retrieval_ms": retrieval_ms, "chunks": []}

    candidates.extend(query_collection("kb_qa_curated", query_embedding, n_results=8))
    retrieval_ms = int((time.time() - started_at) * 1000)
    if retrieval_ms > timeout_ms:
        return {"timed_out": True, "retrieval_ms": retrieval_ms, "chunks": []}

    farmer_id = farmer_profile.get("id")
    if farmer_id:
        candidates.extend(
            query_collection(
                "user_memory",
                query_embedding,
                n_results=2,
                where={"farmer_id": str(farmer_id)},
            )
        )

    deduped = {}
    for candidate in candidates:
        deduped[candidate["id"]] = candidate

    reranked = rerank_candidates(expanded_question, list(deduped.values()), farmer_profile, preferred_language, top_n=3)
    retrieval_ms = int((time.time() - started_at) * 1000)

    return {
        "timed_out": retrieval_ms > timeout_ms,
        "retrieval_ms": retrieval_ms,
        "chunks": reranked,
    }


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "embedding_model": EMBEDDING_MODEL_NAME,
        "collections": {
            "kb_authoritative": safe_collection_count("kb_authoritative"),
            "kb_qa_curated": safe_collection_count("kb_qa_curated"),
            "user_memory": safe_collection_count("user_memory"),
        },
    }


@app.post("/admin/reload")
def admin_reload(request: AdminRequest) -> Dict[str, Any]:
    if not ADMIN_API_KEY or request.admin_key != ADMIN_API_KEY:
        return {"status": "unauthorized"}

    reload_collections()
    return {
        "status": "ok",
        "collections": {
            "kb_authoritative": safe_collection_count("kb_authoritative"),
            "kb_qa_curated": safe_collection_count("kb_qa_curated"),
            "user_memory": safe_collection_count("user_memory"),
        },
    }


@app.post("/memory")
def save_memory(request: MemoryRequest) -> Dict[str, Any]:
    if not request.message or not request.answer:
        return {"status": "skipped"}

    farmer_profile = request.farmer_profile or {}
    details = farmer_profile.get("details", {})
    document = (
        f"User question: {request.message}\n"
        f"Assistant answer: {request.answer}\n"
        f"Location: {farmer_profile.get('location', 'India')}\n"
        f"Crops: {', '.join(farmer_profile.get('crops', []))}\n"
        f"Soil: {details.get('soilType', 'Unknown')}"
    )
    embedding = get_query_embedding(request.message)
    doc_id = safe_text_hash([str(farmer_profile.get("id", "unknown")), request.message, request.answer])

    metadata = {
        "source": "user_memory",
        "topic": "chat_memory",
        "crop": ",".join(farmer_profile.get("crops", [])) or "general",
        "farmer_id": str(farmer_profile.get("id", "unknown")),
        "location": farmer_profile.get("location", "India"),
        "verified": False,
    }
    try:
        resolve_collection("user_memory").upsert(
            documents=[document],
            embeddings=[embedding],
            metadatas=[metadata],
            ids=[doc_id],
        )
    except Exception:
        reload_collections()
        resolve_collection("user_memory").upsert(
            documents=[document],
            embeddings=[embedding],
            metadatas=[metadata],
            ids=[doc_id],
        )
    return {"status": "ok"}


@app.post("/chat")
def chat(request: ChatRequest) -> Dict[str, Any]:
    normalized_key = safe_text_hash(
        [
            normalize_text(request.message),
            request.language,
            normalize_text(request.farmer_profile.get("location", "")),
            str(request.timeout_ms),
        ]
    )

    if request.timeout_ms > 10 and normalized_key in answer_cache:
        cached = answer_cache[normalized_key]
        answer_cache.move_to_end(normalized_key)
        return {**cached, "source": "rag"}

    retrieval_result = retrieve_contexts(request.message, request.language, request.farmer_profile, request.timeout_ms)
    if retrieval_result["timed_out"]:
        return {
            "timed_out": True,
            "response": None,
            "contexts_used": 0,
            "retrieval_ms": retrieval_result["retrieval_ms"],
        }

    generation_started = time.time()
    chunks = retrieval_result["chunks"]
    answer = generate_grounded_answer(request.message, request.language, request.farmer_profile, chunks)
    generation_ms = int((time.time() - generation_started) * 1000)

    payload = {
        "response": answer,
        "contexts_used": len(chunks),
        "retrieval_ms": retrieval_result["retrieval_ms"],
        "generation_ms": generation_ms,
        "timed_out": False,
        "retrieved_sources": [
            {
                "source": chunk.get("metadata", {}).get("source", "unknown"),
                "topic": chunk.get("metadata", {}).get("topic", "general"),
                "crop": chunk.get("metadata", {}).get("crop", "general"),
            }
            for chunk in chunks
        ],
    }
    if request.timeout_ms > 10:
        bounded_cache_put(answer_cache, normalized_key, payload, 256)
    return payload


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=RAG_SERVICE_PORT)
