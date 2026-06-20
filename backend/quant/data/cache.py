from __future__ import annotations
import json
import time
from pathlib import Path
from typing import Any


class FileCache:
    """Tiny JSON file cache with TTL. Keys are hashed to filenames."""

    def __init__(self, directory: str | Path, ttl_seconds: int) -> None:
        self.dir = Path(directory)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.ttl = ttl_seconds

    def _path(self, key: str) -> Path:
        safe = "".join(c if c.isalnum() else "_" for c in key)
        return self.dir / f"{safe}.json"

    def get(self, key: str) -> Any | None:
        p = self._path(key)
        if not p.exists():
            return None
        try:
            payload = json.loads(p.read_text())
        except (json.JSONDecodeError, OSError):
            return None
        if time.time() - payload["_ts"] > self.ttl:
            return None
        return payload["value"]

    def set(self, key: str, value: Any) -> None:
        p = self._path(key)
        p.write_text(json.dumps({"_ts": time.time(), "value": value}))
