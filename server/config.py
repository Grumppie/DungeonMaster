from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
CACHE_DIR = DATA_DIR / "cache"


@dataclass(frozen=True)
class Settings:
    root_dir: Path = ROOT_DIR
    data_dir: Path = DATA_DIR
    cache_dir: Path = CACHE_DIR
    phb_pdf_path: Path = DATA_DIR / "PHB.pdf"
    rules_fallback_path: Path = DATA_DIR / "rules-corpus.md"
    character_sheets_path: Path = ROOT_DIR / "docs" / "character-sheets.md"
    benchmark_path: Path = DATA_DIR / "benchmark-questions.json"
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    embedding_model: str = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    deepgram_api_key: str = os.getenv("DEEPGRAM_API_KEY", "")
    deepgram_model: str = os.getenv("DEEPGRAM_MODEL", "nova-3")
    deepgram_voice: str = os.getenv("DEEPGRAM_VOICE", "aura-2-thalia-en")


settings = Settings()
