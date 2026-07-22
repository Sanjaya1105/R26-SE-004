# Exam service

The exam service accepts lecture PDFs and presentations. PDF uploads are processed with
PyMuPDF before the material is committed to MySQL:

- repeated page headers and footers are removed;
- page-number-only lines in page margins are removed;
- remaining lecture notes are split into overlapping, page-aware chunks;
- embedded images are deduplicated and stored as binary data with page metadata.

## Setup

```powershell
npm install
python -m pip install -r requirements.txt
Copy-Item .env.example .env
npm start
```

Chunk size and overlap can be configured with `PDF_CHUNK_SIZE` and
`PDF_CHUNK_OVERLAP`. Existing databases are migrated automatically at startup.

Run the extraction test with:

```powershell
npm run test:pdf
```

## Extracted content endpoints

- `GET /materials/:id/content` returns text chunks and image metadata.
- `GET /materials/:id/images/:imageId` returns one extracted image.

Both endpoints require the same `x-teacher-id` ownership header as the existing
material routes. The backend gateway exposes them under `/api/exam`.
