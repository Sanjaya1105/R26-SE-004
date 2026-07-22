"""Extract clean lecture text and embedded images from a PDF using PyMuPDF."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path

import fitz


PAGE_NUMBER = re.compile(
    r"^(?:page\s*)?\d+(?:\s*(?:of|/|\|)\s*\d+)?$", re.IGNORECASE
)


def normalize_line(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def margin_lines(page: fitz.Page) -> tuple[set[str], set[str]]:
    top: set[str] = set()
    bottom: set[str] = set()
    page_height = page.rect.height
    for block in page.get_text("blocks", sort=True):
        y0, y1, text = block[1], block[3], block[4]
        for line in text.splitlines():
            normalized = normalize_line(line)
            if not normalized:
                continue
            if y1 <= page_height * 0.15:
                top.add(normalized)
            if y0 >= page_height * 0.85:
                bottom.add(normalized)
    return top, bottom


def repeated_margin_lines(document: fitz.Document) -> set[str]:
    top_counts: Counter[str] = Counter()
    bottom_counts: Counter[str] = Counter()
    for page in document:
        top, bottom = margin_lines(page)
        top_counts.update(top)
        bottom_counts.update(bottom)

    # Two occurrences are enough for short lecture files; longer documents need
    # the line on at least half their pages to avoid deleting real note content.
    threshold = 2 if document.page_count <= 4 else max(2, math.ceil(document.page_count * 0.5))
    return {
        line
        for line, count in top_counts.items()
        if count >= threshold
    } | {
        line
        for line, count in bottom_counts.items()
        if count >= threshold
    }


def clean_page_text(page: fitz.Page, repeated: set[str]) -> str:
    paragraphs: list[str] = []
    page_height = page.rect.height
    for block in page.get_text("blocks", sort=True):
        if len(block) < 7 or block[6] != 0:
            continue
        y0, y1, raw_text = block[1], block[3], block[4]
        kept: list[str] = []
        for line in raw_text.splitlines():
            text = re.sub(r"\s+", " ", line).strip()
            normalized = normalize_line(text)
            in_margin = y1 <= page_height * 0.15 or y0 >= page_height * 0.85
            if not text or (in_margin and normalized in repeated):
                continue
            if in_margin and PAGE_NUMBER.fullmatch(text):
                continue
            kept.append(text)
        if kept:
            paragraphs.append(" ".join(kept))
    return "\n\n".join(paragraphs)


def chunks_for_page(text: str, page_number: int, size: int, overlap: int) -> list[dict]:
    if not text:
        return []
    chunks: list[dict] = []
    cursor = 0
    while cursor < len(text):
        end = min(cursor + size, len(text))
        if end < len(text):
            candidates = [
                text.rfind("\n\n", cursor + size // 2, end),
                text.rfind(". ", cursor + size // 2, end),
                text.rfind(" ", cursor + size // 2, end),
            ]
            boundary = max(candidates)
            if boundary > cursor:
                end = boundary + (1 if text[boundary] == " " else 0)
        content = text[cursor:end].strip()
        if content:
            chunks.append({"pageNumber": page_number, "content": content})
        if end >= len(text):
            break
        next_cursor = max(cursor + 1, end - overlap)
        while next_cursor < end and not text[next_cursor].isspace():
            next_cursor += 1
        cursor = next_cursor
    return chunks


def extract_images(document: fitz.Document, output_dir: Path) -> list[dict]:
    output_dir.mkdir(parents=True, exist_ok=True)
    images: list[dict] = []
    seen_hashes: set[str] = set()
    for page_number, page in enumerate(document, start=1):
        for image in page.get_images(full=True):
            extracted = document.extract_image(image[0])
            data = extracted["image"]
            digest = hashlib.sha256(data).hexdigest()
            if digest in seen_hashes:
                continue
            # Ignore tiny decorative bullets and transparent spacer graphics.
            width = int(extracted.get("width") or 0)
            height = int(extracted.get("height") or 0)
            if width < 32 or height < 32:
                continue
            seen_hashes.add(digest)
            extension = re.sub(r"[^a-zA-Z0-9]", "", extracted.get("ext", "bin")) or "bin"
            file_name = f"image-{len(images):04d}.{extension}"
            (output_dir / file_name).write_bytes(data)
            images.append(
                {
                    "pageNumber": page_number,
                    "fileName": file_name,
                    "mimeType": f"image/{'jpeg' if extension in ('jpg', 'jpeg') else extension}",
                    "width": width or None,
                    "height": height or None,
                    "byteSize": len(data),
                    "hash": digest,
                }
            )
    return images


def extract(pdf_path: Path, output_dir: Path, chunk_size: int, overlap: int) -> dict:
    with fitz.open(pdf_path) as document:
        if document.needs_pass:
            raise ValueError("Password-protected PDFs are not supported.")
        repeated = repeated_margin_lines(document)
        chunks: list[dict] = []
        for page_number, page in enumerate(document, start=1):
            chunks.extend(chunks_for_page(clean_page_text(page, repeated), page_number, chunk_size, overlap))
        for index, chunk in enumerate(chunks):
            chunk["chunkIndex"] = index
            chunk["characterCount"] = len(chunk["content"])
        images = extract_images(document, output_dir)
        for index, image in enumerate(images):
            image["imageIndex"] = index
        return {"pageCount": document.page_count, "chunks": chunks, "images": images}


def serialize_result(result: dict) -> str:
    # Keep stdout ASCII-safe on Windows, where a spawned Python process may use
    # cp1252. JSON.parse restores escaped Unicode characters to their originals.
    return json.dumps(result, ensure_ascii=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_path", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--chunk-size", type=int, default=1200)
    parser.add_argument("--overlap", type=int, default=150)
    args = parser.parse_args()
    if args.chunk_size < 200 or args.overlap < 0 or args.overlap >= args.chunk_size:
        raise ValueError("Invalid chunk size or overlap.")
    result = extract(args.pdf_path, args.output_dir, args.chunk_size, args.overlap)
    print(serialize_result(result))


if __name__ == "__main__":
    main()
