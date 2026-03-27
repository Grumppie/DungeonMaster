from __future__ import annotations

import json
from pathlib import Path
from typing import Any


DEFAULT_BENCHMARKS: list[dict[str, Any]] = [
    {
        "id": "alden-combat-profile",
        "category": "demo-character",
        "difficulty": "medium",
        "question": "Give Alden Voss's combat profile for this duel: armor class, hit points, speed, initiative modifier, and greataxe attack and damage.",
        "must_include_all": ["14", "32", "30", "+2", "+5", "1d12+3"],
        "must_include_any": [["armor class", "ac"], ["hit points", "hp"], ["speed"], ["initiative"], ["greataxe"], ["slashing"]],
    },
]


class BenchmarkSuite:
    def __init__(self, path: Path):
        self.path = path

    def list_questions(self) -> list[dict[str, Any]]:
        return self._load()

    def selected_questions(self, benchmark_ids: list[str] | None) -> list[dict[str, Any]]:
        questions = self._load()
        if not benchmark_ids:
            return questions
        wanted = set(benchmark_ids)
        return [question for question in questions if question["id"] in wanted]

    def score_answer(self, question: dict[str, Any], answer: str) -> dict[str, Any]:
        lower = answer.lower()
        must_include_all = [keyword.lower() for keyword in question.get("must_include_all", [])]
        must_include_any = [
            [option.lower() for option in group]
            for group in question.get("must_include_any", [])
            if isinstance(group, list) and group
        ]
        legacy_expected = [keyword.lower() for keyword in question.get("expected_keywords", [])]
        if legacy_expected and not must_include_all:
            must_include_all = legacy_expected

        matched_all = [keyword for keyword in must_include_all if keyword in lower]
        missed_all = [keyword for keyword in must_include_all if keyword not in lower]

        matched_any = []
        missed_any = []
        for group in must_include_any:
            hit = next((option for option in group if option in lower), None)
            if hit:
                matched_any.append({"expected": group, "matched": hit})
            else:
                missed_any.append(group)

        total = len(must_include_all) + len(must_include_any)
        hits = len(matched_all) + len(matched_any)
        return {
            "matched": matched_all,
            "missed": missed_all,
            "matchedAnyGroups": matched_any,
            "missedAnyGroups": missed_any,
            "score": round((hits / total), 3) if total else None,
        }

    def _load(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            return DEFAULT_BENCHMARKS
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return DEFAULT_BENCHMARKS
        if not isinstance(payload, list):
            return DEFAULT_BENCHMARKS
        return payload
