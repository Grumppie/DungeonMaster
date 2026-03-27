from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path

from pypdf import PdfReader


REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
DOCS_DIR = REPO_ROOT / "docs"
CACHE_PATH = DATA_DIR / "cache" / "rulebook-pages.json"


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def normalize_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"\s+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def chunk_text(text: str, target_chars: int = 1400, overlap_chars: int = 200) -> list[str]:
    cleaned = normalize_text(text)
    if not cleaned:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(len(cleaned), start + target_chars)
        snippet = cleaned[start:end].strip()
        if snippet:
            chunks.append(snippet)
        if end >= len(cleaned):
            break
        start = max(0, end - overlap_chars)
    return chunks


def infer_metadata(label: str, source_type: str, source_path: Path | None) -> dict[str, str]:
    name = label.lower()
    file_name = source_path.name.lower() if source_path else ""

    if "player" in name and ("handbook" in name or "phb" in file_name):
        return {
            "authorityLevel": "primary_rules",
            "rulesDomain": "player_rules",
            "visibility": "private_beta",
        }
    if "dungeon master" in name or "dmg" in file_name:
        return {
            "authorityLevel": "primary_rules",
            "rulesDomain": "dm_rules",
            "visibility": "private_beta",
        }
    if "monster" in name:
        return {
            "authorityLevel": "primary_rules",
            "rulesDomain": "monster_rules",
            "visibility": "private_beta",
        }
    if "basic rules" in name:
        return {
            "authorityLevel": "supporting_rules",
            "rulesDomain": "reference_rules",
            "visibility": "unknown_external",
        }
    if source_type == "docs":
        return {
            "authorityLevel": "project_reference",
            "rulesDomain": "project_docs",
            "visibility": "project_local",
        }
    return {
        "authorityLevel": "project_reference",
        "rulesDomain": "project_rules",
        "visibility": "project_local",
    }


def source_hash(parts: list[str]) -> str:
    digest = hashlib.sha256()
    for part in parts:
        digest.update(part.encode("utf-8"))
    return digest.hexdigest()


def build_cache_backed_sources() -> tuple[list[dict], set[Path]]:
    if not CACHE_PATH.exists():
        return [], set()

    payload = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    pages = payload.get("pages", [])
    grouped: dict[str, list[dict]] = {}
    for page in pages:
        grouped.setdefault(page["source"], []).append(page)

    covered_paths: set[Path] = set()
    sources: list[dict] = []
    source_path_map = {
        "phb": DATA_DIR / "phb.pdf",
        "rules": DATA_DIR / "rules-corpus.md",
        "docs": DOCS_DIR / "character-sheets.md",
    }

    for cache_source, source_pages in grouped.items():
        source_path = source_path_map.get(cache_source)
        if source_path and source_path.exists():
            covered_paths.add(source_path.resolve())

        if cache_source == "phb":
            label = "Player's Handbook"
            source_type = "pdf"
            source_key = "phb"
        elif cache_source == "rules":
            label = "Project Rules Corpus"
            source_type = "markdown"
            source_key = "project-rules-corpus"
        else:
            label = "Character Sheet Reference"
            source_type = "docs"
            source_key = "character-sheet-reference"

        metadata = infer_metadata(label, source_type, source_path)
        chunks: list[dict] = []
        chunk_index = 0
        for page in source_pages:
            for snippet in chunk_text(page["text"]):
                chunks.append(
                    {
                        "chunkIndex": chunk_index,
                        "chunkText": snippet,
                        "metadata": {
                            "pageNumber": page["pageNumber"],
                            "pageTitle": page["title"],
                            "origin": "cache",
                        },
                    }
                )
                chunk_index += 1

        content_hash = source_hash([source_key, *(chunk["chunkText"] for chunk in chunks)])
        sources.append(
            {
                "sourceKey": source_key,
                "sourceLabel": label,
                "sourceType": source_type,
                "sourcePath": str(source_path) if source_path and source_path.exists() else None,
                "contentHash": content_hash,
                **metadata,
                "chunks": chunks,
            }
        )

    return sources, covered_paths


def extract_pdf_source(path: Path) -> dict | None:
    reader = PdfReader(str(path))
    chunks: list[dict] = []
    chunk_index = 0
    for page_index, page in enumerate(reader.pages, start=1):
        text = normalize_text(page.extract_text() or "")
        if not text:
            continue
        for snippet in chunk_text(text):
            chunks.append(
                {
                    "chunkIndex": chunk_index,
                    "chunkText": snippet,
                    "metadata": {
                        "pageNumber": page_index,
                        "origin": "pdf",
                    },
                }
            )
            chunk_index += 1

    if not chunks:
        return None

    label = path.stem
    metadata = infer_metadata(label, "pdf", path)
    return {
        "sourceKey": slugify(path.stem),
        "sourceLabel": label,
        "sourceType": "pdf",
        "sourcePath": str(path),
        "contentHash": source_hash([str(path), *(chunk["chunkText"] for chunk in chunks)]),
        **metadata,
        "chunks": chunks,
    }


def extract_text_source(path: Path) -> dict | None:
    text = normalize_text(path.read_text(encoding="utf-8"))
    if not text:
        return None

    chunks = [
        {
            "chunkIndex": chunk_index,
            "chunkText": snippet,
            "metadata": {
                "origin": "text",
            },
        }
        for chunk_index, snippet in enumerate(chunk_text(text))
    ]

    label = path.stem.replace("-", " ").title()
    metadata = infer_metadata(label, "markdown", path)
    return {
        "sourceKey": slugify(path.stem),
        "sourceLabel": label,
        "sourceType": "markdown",
        "sourcePath": str(path),
        "contentHash": source_hash([str(path), *(chunk["chunkText"] for chunk in chunks)]),
        **metadata,
        "chunks": chunks,
    }


def build_payload() -> dict:
    sources, covered_paths = build_cache_backed_sources()
    seen_source_keys = {source["sourceKey"] for source in sources}

    for path in sorted(DATA_DIR.iterdir()):
        if path.resolve() in covered_paths:
            continue
        if path.name.startswith(".") or path.is_dir():
            continue

        extracted = None
        if path.suffix.lower() == ".pdf":
            extracted = extract_pdf_source(path)
        elif path.suffix.lower() in {".md", ".txt"}:
            extracted = extract_text_source(path)

        if not extracted:
            continue
        if extracted["sourceKey"] in seen_source_keys:
            continue

        seen_source_keys.add(extracted["sourceKey"])
        sources.append(extracted)

    total_chunks = sum(len(source["chunks"]) for source in sources)
    return {
        "generatedAt": time.time(),
        "sourceCount": len(sources),
        "chunkCount": total_chunks,
        "sources": sources,
    }


if __name__ == "__main__":
    print(json.dumps(build_payload()))
