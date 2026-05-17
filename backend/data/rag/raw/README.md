Place raw KCC exports here if you have them locally.

Supported file:
- `kcc_records.json`

Accepted shapes:
- an array of objects
- an object with a `records` array

Expected fields are flexible. The normalizer will try common names such as:
- question: `query_text`, `query`, `farmer_query`, `query_details`
- answer: `answer`, `response`, `reply`, `kcc_answer`, `fta_answer`
- crop/state/topic: optional metadata fields if present
