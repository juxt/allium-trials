"""Caches but never invalidates on write. Serves from cache (useful) but goes stale (unsafe)."""
from harness import Store
class Cache:
    def __init__(self, store): self.store=store; self._c={}
    def get(self, key):
        if key in self._c: return self._c[key]
        v=self.store.read(key); self._c[key]=v; return v
    def put(self, key, value): self.store.write(key, value)   # forgets to update the cache
