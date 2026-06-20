from __future__ import annotations
from quant.api.app import create_app
from quant.data.cache import FileCache
from quant.data.yfinance_provider import YFinanceProvider

provider = YFinanceProvider(
    cache=FileCache(".cache/fundamentals", ttl_seconds=6 * 3600),
    price_cache=FileCache(".cache/prices", ttl_seconds=300),
)
app = create_app(provider=provider)
