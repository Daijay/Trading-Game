import time
from quant.data.cache import FileCache


def test_cache_round_trips_json(tmp_path):
    cache = FileCache(tmp_path, ttl_seconds=60)
    cache.set("k", {"a": 1})
    assert cache.get("k") == {"a": 1}


def test_cache_expires(tmp_path):
    cache = FileCache(tmp_path, ttl_seconds=0)
    cache.set("k", {"a": 1})
    time.sleep(0.01)
    assert cache.get("k") is None


def test_cache_miss_returns_none(tmp_path):
    cache = FileCache(tmp_path, ttl_seconds=60)
    assert cache.get("absent") is None
