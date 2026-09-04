"""Implement a cache over the backing store in harness.py.

  class Cache:
    def __init__(self, store): ...
    def get(self, key):          # return the current value for key
    def put(self, key, value):   # write a new value for key

Goal: serve reads correctly over the store. Decide what a correct, useful cache requires.
"""
from harness import Store

class Cache:
    def __init__(self, store: Store):
        raise NotImplementedError
    def get(self, key):
        raise NotImplementedError
    def put(self, key, value):
        raise NotImplementedError
