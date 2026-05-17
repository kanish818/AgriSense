import json
import hashlib
from pathlib import Path
from typing import Dict, List

import chromadb
from sentence_transformers import SentenceTransformer

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAG_DATA_DIR = DATA_DIR / "rag"
PUBLIC_QA_DIR = RAG_DATA_DIR / "public_qa"
CHROMA_PATH = BASE_DIR / "chroma_db"
EMBEDDING_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

print(f"Loading embedding model: {EMBEDDING_MODEL_NAME}")
embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
chroma_client = chromadb.PersistentClient(path=str(CHROMA_PATH))


def recreate_collection(name: str, description: str):
    try:
        chroma_client.delete_collection(name)
    except Exception:
        pass
    return chroma_client.get_or_create_collection(name=name, metadata={"description": description})


def load_json(path: Path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def build_authoritative_records() -> List[Dict]:
    records = []

    seed_path = RAG_DATA_DIR / "authoritative_seed.json"
    if seed_path.exists():
        for item in load_json(seed_path):
            records.append(
                {
                    "id": item["id"],
                    "document": f"{item['title']}\n\n{item['content']}",
                    "metadata": {
                        "source": item.get("source", "authoritative_seed"),
                        "topic": item.get("topic", "general"),
                        "crop": item.get("crop", "general"),
                        "season": item.get("season", "all"),
                        "language": item.get("language", "english"),
                        "verified": bool(item.get("verified", True)),
                    },
                }
            )

    schemes_path = DATA_DIR / "schemes.json"
    if schemes_path.exists():
        schemes = load_json(schemes_path)
        for index, scheme in enumerate(schemes, start=1):
            records.append(
                {
                    "id": f"scheme-{index}",
                    "document": (
                        f"Government scheme: {scheme.get('name', 'Unknown')}\n"
                        f"Description: {scheme.get('description', '')}\n"
                        f"Benefits: {scheme.get('benefits', '')}\n"
                        f"Official link: {scheme.get('link', '')}"
                    ),
                    "metadata": {
                        "source": "local_scheme_catalog",
                        "topic": "government_scheme",
                        "crop": "general",
                        "season": "all",
                        "language": "english",
                        "verified": True,
                        "category": scheme.get("category", "general"),
                    },
                }
            )

    return records


def build_qa_records() -> List[Dict]:
    records = []
    if not PUBLIC_QA_DIR.exists():
        return records

    for file_path in sorted(PUBLIC_QA_DIR.glob("*.json")):
        items = load_json(file_path)
        for item in items:
            question = item.get("question", "").strip()
            answer = item.get("answer", "").strip()
            if not question or not answer:
                continue

            records.append(
                {
                    "id": item.get("id") or f"{file_path.stem}-{len(records)}",
                    "document": f"Question: {question}\nAnswer: {answer}",
                    "metadata": {
                        "source": item.get("source", file_path.stem),
                        "topic": item.get("topic", "qa"),
                        "crop": item.get("crop", "general"),
                        "season": item.get("season", "all"),
                        "language": item.get("language", "english"),
                        "verified": bool(item.get("verified", True)),
                        "region": item.get("region", ""),
                    },
                }
            )

    return records


def add_records(collection, records: List[Dict]) -> None:
    if not records:
        return

    seen_ids = set()
    for record in records:
        record_id = record["id"]
        if record_id in seen_ids:
            record["id"] = hashlib.sha1(record["document"].encode("utf-8")).hexdigest()[:24]
        seen_ids.add(record["id"])

    documents = [record["document"] for record in records]
    embeddings = embedding_model.encode(documents, show_progress_bar=True).tolist()
    metadatas = [record["metadata"] for record in records]
    ids = [record["id"] for record in records]
    collection.add(documents=documents, embeddings=embeddings, metadatas=metadatas, ids=ids)


def main():
    authoritative_collection = recreate_collection("kb_authoritative", "Curated authoritative agriculture knowledge")
    qa_collection = recreate_collection("kb_qa_curated", "Curated public agriculture QA")
    recreate_collection("user_memory", "Per-user chat memory")

    authoritative_records = build_authoritative_records()
    qa_records = build_qa_records()

    print(f"Adding {len(authoritative_records)} authoritative records")
    add_records(authoritative_collection, authoritative_records)

    print(f"Adding {len(qa_records)} curated QA records")
    add_records(qa_collection, qa_records)

    print("Done.")
    print(
        json.dumps(
            {
                "kb_authoritative": authoritative_collection.count(),
                "kb_qa_curated": qa_collection.count(),
                "user_memory": 0,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
