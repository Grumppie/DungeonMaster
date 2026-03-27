from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from time import time
from typing import Any

from pypdf import PdfReader

from server.config import Settings


def clean_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"\s+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


class CorpusManager:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.settings.cache_dir.mkdir(parents=True, exist_ok=True)
        self._pages_cache: list[dict[str, Any]] | None = None

    @property
    def text_cache_path(self) -> Path:
        return self.settings.cache_dir / "rulebook-pages.json"

    @property
    def vector_cache_path(self) -> Path:
        return self.settings.cache_dir / "rag-vector-index.json"

    def corpus_status(self) -> dict[str, Any]:
        pages = self.get_rulebook_pages()
        chunks = self.chunk_pages(pages)
        source = "pdf" if self.settings.phb_pdf_path.exists() else "fallback"
        return {
            "source": source,
            "hasPdf": self.settings.phb_pdf_path.exists(),
            "path": str(self.settings.phb_pdf_path if source == "pdf" else self.settings.rules_fallback_path),
            "pageCount": len(pages),
            "chunkCount": len(chunks),
            "corpusHash": self.compute_corpus_hash(pages),
            "title": "Player's Handbook" if source == "pdf" else "Fallback Duel Corpus",
        }

    def get_rulebook_pages(self) -> list[dict[str, Any]]:
        if self._pages_cache is not None:
            return self._pages_cache

        cache = self._read_cached_pages()
        if cache is not None:
            self._pages_cache = cache["pages"]
            return self._pages_cache

        pages = self._extract_pages()
        payload = {
            "sourceSignature": self._source_signature(),
            "createdAt": time(),
            "pages": pages,
        }
        self.text_cache_path.write_text(json.dumps(payload), encoding="utf-8")
        self._pages_cache = pages
        return pages

    def chunk_pages(
        self,
        pages: list[dict[str, Any]],
        target_chars: int = 1400,
        overlap_chars: int = 200,
    ) -> list[dict[str, Any]]:
        chunks: list[dict[str, Any]] = []
        for page in pages:
            text = page["text"]
            if not text:
                continue
            start = 0
            chunk_index = 0
            while start < len(text):
                end = min(len(text), start + target_chars)
                snippet = text[start:end].strip()
                if snippet:
                    chunks.append(
                        {
                            "id": f"{page['source']}-{page['pageNumber']}-{chunk_index}",
                            "title": page["title"],
                            "source": page["source"],
                            "pageNumber": page["pageNumber"],
                            "text": snippet,
                        }
                    )
                    chunk_index += 1
                if end >= len(text):
                    break
                start = max(0, end - overlap_chars)
        return chunks

    def build_rlm_context(self) -> dict[str, Any]:
        pages = self.get_rulebook_pages()
        supporting_pages = []
        primary_pages = []
        for page in pages:
            payload = {
                "page_number": page["pageNumber"],
                "label": f"{page['title']} p.{page['pageNumber']}",
                "source": page["source"],
                "text": page["text"],
            }
            if page["source"] == "phb":
                primary_pages.append(payload)
            else:
                supporting_pages.append(payload)
        return {
            "title": "Player's Handbook" if self.settings.phb_pdf_path.exists() else "Fallback Duel Corpus",
            "corpus_hash": self.compute_corpus_hash(pages),
            "pages": primary_pages + supporting_pages,
            "primary_pages": primary_pages,
            "supporting_pages": supporting_pages,
            "source_index": {
                "phb": [page["pageNumber"] for page in pages if page["source"] == "phb"],
                "supporting": [page["pageNumber"] for page in pages if page["source"] != "phb"],
            },
        }

    def compute_corpus_hash(self, pages: list[dict[str, Any]]) -> str:
        digest = hashlib.sha256()
        digest.update(self._source_signature().encode("utf-8"))
        for page in pages:
            digest.update(str(page["pageNumber"]).encode("utf-8"))
            digest.update(page["source"].encode("utf-8"))
            digest.update(page["text"].encode("utf-8"))
        return digest.hexdigest()

    def _source_signature(self) -> str:
        signatures: list[str] = []
        if self.settings.phb_pdf_path.exists():
            stat = self.settings.phb_pdf_path.stat()
            signatures.append(f"pdf:{self.settings.phb_pdf_path}:{stat.st_mtime_ns}:{stat.st_size}")
        for path in (self.settings.rules_fallback_path, self.settings.character_sheets_path):
            if path.exists():
                stat = path.stat()
                signatures.append(f"{path}:{stat.st_mtime_ns}:{stat.st_size}")
        return "|".join(signatures)

    def _read_cached_pages(self) -> dict[str, Any] | None:
        if not self.text_cache_path.exists():
            return None
        try:
            payload = json.loads(self.text_cache_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return None
        if payload.get("sourceSignature") != self._source_signature():
            return None
        pages = payload.get("pages")
        if not isinstance(pages, list):
            return None
        return payload

    def _extract_pages(self) -> list[dict[str, Any]]:
        pages: list[dict[str, Any]] = []
        if self.settings.phb_pdf_path.exists():
            pages.extend(self._extract_pdf_pages(self.settings.phb_pdf_path))
        pages.extend(self._extract_supporting_pages(start_index=len(pages)))
        return pages

    def _extract_pdf_pages(self, path: Path) -> list[dict[str, Any]]:
        reader = PdfReader(str(path))
        pages: list[dict[str, Any]] = []
        for index, page in enumerate(reader.pages):
            text = clean_text(page.extract_text() or "")
            if not text:
                continue
            pages.append(
                {
                    "pageNumber": index + 1,
                    "title": "Player's Handbook",
                    "source": "phb",
                    "text": text,
                }
            )
        return pages

    def _extract_supporting_pages(self, start_index: int = 0) -> list[dict[str, Any]]:
        pages: list[dict[str, Any]] = []
        for path, title, source in (
            (self.settings.rules_fallback_path, "Duel Rules Corpus", "rules"),
            (self.settings.character_sheets_path, "Character Sheets", "docs"),
        ):
            if not path.exists():
                continue
            text = clean_text(path.read_text(encoding="utf-8"))
            if text:
                pages.append(
                    {
                        "pageNumber": start_index + len(pages) + 1,
                        "title": title,
                        "source": source,
                        "text": text,
                    }
                )
        return pages
