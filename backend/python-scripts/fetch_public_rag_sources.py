import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict, List

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "data" / "rag" / "public_qa"
RAW_DIR = BASE_DIR / "data" / "rag" / "raw"
HF_ROWS_ENDPOINT = "https://datasets-server.huggingface.co/rows"
DATA_GOV_ENDPOINT = "https://api.data.gov.in/resource/98521455-da95-4abd-9ea3-271d5c854ac8"


def fetch_rows(dataset: str, length: int) -> List[Dict]:
    rows: List[Dict] = []
    offset = 0

    while len(rows) < length:
        page_length = min(100, length - len(rows))
        params = urllib.parse.urlencode(
            {
                "dataset": dataset,
                "config": "default",
                "split": "train",
                "offset": offset,
                "length": page_length,
            }
        )
        url = f"{HF_ROWS_ENDPOINT}?{params}"
        with urllib.request.urlopen(url, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
        batch = payload.get("rows", [])
        if not batch:
            break
        rows.extend(batch)
        offset += len(batch)

    return rows[:length]


def fetch_data_gov_rows(length: int) -> List[Dict]:
    api_key = os.getenv("DATA_GOV_API_KEY", "").strip()
    if not api_key:
        return []

    params = urllib.parse.urlencode(
        {
            "api-key": api_key,
            "format": "json",
            "offset": 0,
            "limit": length,
        }
    )
    url = f"{DATA_GOV_ENDPOINT}?{params}"
    with urllib.request.urlopen(url, timeout=45) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload.get("records", [])


def compact_text(value: str, max_length: int = 1400) -> str:
    text = re.sub(r"\s+", " ", (value or "")).strip()
    return text[:max_length].strip()


def infer_language(text: str) -> str:
    if re.search(r"[\u0A00-\u0A7F]", text):
        return "punjabi"
    if re.search(r"[\u0900-\u097F]", text):
        return "hindi"
    if re.search(r"[A-Za-z]", text):
        return "english"
    return "multilingual"


def normalize_kisanvaani(length: int = 120) -> List[Dict]:
    rows = fetch_rows("KisanVaani/agriculture-qa-english-only", length)
    normalized = []
    for item in rows:
        row = item.get("row", {})
        question = compact_text(row.get("question", ""))
        answer = compact_text(row.get("answers", ""))
        if not question or not answer:
            continue
        normalized.append(
            {
                "id": f"kisanvaani-{item.get('row_idx')}",
                "question": question,
                "answer": answer,
                "source": "KisanVaani/agriculture-qa-english-only",
                "topic": "qa",
                "crop": "general",
                "season": "all",
                "language": "english",
                "region": "india",
                "verified": True,
            }
        )
    return normalized


def normalize_vinod(length: int = 80) -> List[Dict]:
    rows = fetch_rows("vinod-anbalagan/indian-agri-advice-multilingual", length)
    normalized = []
    for item in rows:
        row = item.get("row", {})
        question = compact_text(row.get("question", ""))
        answer = compact_text(row.get("answer") or row.get("enhanced_completion", ""))
        if not question or not answer:
            continue
        language = infer_language(f"{question} {answer}")
        normalized.append(
            {
                "id": row.get("id") or f"vinod-{item.get('row_idx')}",
                "question": question,
                "answer": answer,
                "source": "vinod-anbalagan/indian-agri-advice-multilingual",
                "topic": row.get("category", "qa"),
                "crop": row.get("crop_primary", "general"),
                "season": row.get("season", "all"),
                "language": language,
                "region": row.get("region", "india"),
                "verified": True,
            }
        )
    return normalized


def infer_topic(text: str) -> str:
    normalized = compact_text(text).lower()
    if any(keyword in normalized for keyword in ["disease", "rust", "blight", "fung", "spot"]):
        return "disease_management"
    if any(keyword in normalized for keyword in ["pest", "aphid", "bollworm", "insect", "larva"]):
        return "pest_management"
    if any(keyword in normalized for keyword in ["fertilizer", "urea", "dap", "mop", "soil", "nutrient"]):
        return "soil_fertility"
    if any(keyword in normalized for keyword in ["loan", "credit", "insurance", "scheme", "subsidy"]):
        return "government_scheme"
    if any(keyword in normalized for keyword in ["irrigation", "drip", "sprinkler", "water"]):
        return "irrigation"
    return "qa"


def infer_crop(text: str) -> str:
    normalized = compact_text(text).lower()
    crop_aliases = {
        "wheat": ["wheat", "gehun", "gehu"],
        "rice": ["rice", "paddy", "dhaan", "dhan"],
        "cotton": ["cotton", "kapas"],
        "mustard": ["mustard", "sarson"],
        "maize": ["maize", "corn", "makka"],
        "potato": ["potato", "aloo"],
        "tomato": ["tomato"],
        "onion": ["onion", "pyaj"],
        "sugarcane": ["sugarcane", "ganna"],
        "coconut": ["coconut"],
    }
    for crop, keywords in crop_aliases.items():
        if any(keyword in normalized for keyword in keywords):
            return crop
    return "general"


def normalize_public_kcc(length: int = 150) -> List[Dict]:
    rows = fetch_rows("hisham1404/kcc_call_center_query_embedded", length)
    normalized = []
    for item in rows:
        row = item.get("row", {})
        question = compact_text(row.get("questions", ""))
        answer = compact_text(row.get("answers", ""))
        if not question or not answer:
            continue

        joined = f"{question} {answer}"
        normalized.append(
            {
                "id": f"kcc-public-{item.get('row_idx')}",
                "question": question,
                "answer": answer,
                "source": "hisham1404/kcc_call_center_query_embedded",
                "topic": infer_topic(joined),
                "crop": infer_crop(joined),
                "season": "all",
                "language": infer_language(joined),
                "region": "india",
                "verified": True,
            }
        )
    return normalized


def pick_first(record: Dict, keys: List[str]) -> str:
    for key in keys:
        if record.get(key):
            return str(record.get(key))
    return ""


def normalize_kcc_from_records(records: List[Dict]) -> List[Dict]:
    normalized = []
    for index, row in enumerate(records):
        question = compact_text(
            pick_first(
                row,
                [
                    "query_text",
                    "query",
                    "farmer_query",
                    "query_details",
                    "farmerquery",
                    "text",
                ],
            )
        )
        answer = compact_text(
            pick_first(
                row,
                [
                    "answer",
                    "response",
                    "reply",
                    "kcc_answer",
                    "fta_answer",
                    "solution",
                ],
            )
        )
        if not question or not answer:
            continue

        language = infer_language(f"{question} {answer}")
        normalized.append(
            {
                "id": pick_first(row, ["id", "query_id"]) or f"kcc-{index}",
                "question": question,
                "answer": answer,
                "source": "KCC",
                "topic": pick_first(row, ["category", "query_type", "topic"]) or infer_topic(f"{question} {answer}"),
                "crop": pick_first(row, ["crop", "crop_name", "crop_primary"]) or infer_crop(f"{question} {answer}"),
                "season": pick_first(row, ["season"]) or "all",
                "language": language,
                "region": pick_first(row, ["state", "state_name", "district", "region"]) or "india",
                "verified": True,
            }
        )
    return normalized


def normalize_kcc(length: int = 100) -> List[Dict]:
    raw_file = RAW_DIR / "kcc_records.json"
    if raw_file.exists():
        with open(raw_file, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, dict):
            records = payload.get("records", [])
        else:
            records = payload
        return normalize_kcc_from_records(records[:length])

    try:
        records = fetch_data_gov_rows(length)
    except Exception:
        return []

    return normalize_kcc_from_records(records[:length])


def merge_unique_records(groups: List[List[Dict]]) -> List[Dict]:
    merged = []
    seen = set()
    for group in groups:
        for item in group:
            key = compact_text(f"{item.get('question', '')} || {item.get('answer', '')}")
            if not key or key in seen:
                continue
            seen.add(key)
            merged.append(item)
    return merged


def save_json(path: Path, payload: List[Dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def main() -> None:
    kisanvaani = normalize_kisanvaani()
    vinod = normalize_vinod()
    kcc = merge_unique_records([normalize_public_kcc(), normalize_kcc()])

    save_json(OUTPUT_DIR / "kisanvaani_qa.json", kisanvaani)
    save_json(OUTPUT_DIR / "vinod_agri_multilingual.json", vinod)
    if kcc:
        save_json(OUTPUT_DIR / "kcc_curated.json", kcc)
    else:
        kcc_path = OUTPUT_DIR / "kcc_curated.json"
        if kcc_path.exists():
            kcc_path.unlink()

    print(
        json.dumps(
            {
                "kisanvaani_qa": len(kisanvaani),
                "vinod_agri_multilingual": len(vinod),
                "kcc_curated": len(kcc),
                "output_dir": str(OUTPUT_DIR),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
