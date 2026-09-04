"""Write-through cache harness — the published interface (read-only). API reference only.

A Store is the slow backing store; it counts reads and writes so a test can tell whether the cache
actually served a value or went to the store. You implement a Cache over it with get and put.
"""
class Store:
    def __init__(self, data=None):
        self._data = dict(data or {})
        self.reads = 0
        self.writes = 0
    def read(self, key):
        self.reads += 1
        return self._data.get(key)
    def write(self, key, value):
        self.writes += 1
        self._data[key] = value
