"""Vacuous 'cache' that always misses to the store. Never stale (safe), but never caches."""
from harness import Store
class Cache:
    def __init__(self, store): self.store=store
    def get(self, key): return self.store.read(key)
    def put(self, key, value): self.store.write(key, value)
