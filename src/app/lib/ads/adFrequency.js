"use client";

const STORAGE_KEY = "modcodes-ad-frequency";
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadFrequencyData() {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveFrequencyData(data) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function canShowAd(placement, cooldownMs = DEFAULT_COOLDOWN_MS) {
  const data = loadFrequencyData();
  const lastShown = data[placement];
  if (!lastShown) return true;
  return Date.now() - lastShown > cooldownMs;
}

export function recordAdShown(placement) {
  const data = loadFrequencyData();
  data[placement] = Date.now();
  saveFrequencyData(data);
}

export function getAdCooldownRemaining(placement, cooldownMs = DEFAULT_COOLDOWN_MS) {
  const data = loadFrequencyData();
  const lastShown = data[placement];
  if (!lastShown) return 0;
  const remaining = cooldownMs - (Date.now() - lastShown);
  return remaining > 0 ? remaining : 0;
}

export function resetAdFrequency(placement) {
  const data = loadFrequencyData();
  delete data[placement];
  saveFrequencyData(data);
}

export function resetAllAdFrequency() {
  saveFrequencyData({});
}
