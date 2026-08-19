const MAX_ENTRIES = 200;

const cache = new Map();

export function getAnalysis(path, versionKey) {
  const entry = cache.get(path);
  if (entry && entry.key === versionKey) {
    return entry.result;
  }
  return null;
}

export function setAnalysis(path, versionKey, result) {
  cache.set(path, { key: versionKey, result });
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

export function clearAnalysis(path) {
  cache.delete(path);
}

export function clearAllAnalysis() {
  cache.clear();
}

export function cacheSize() {
  return cache.size;
}