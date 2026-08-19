export const DEFAULT_CONTEXT_BUDGET = 24000;

export const BUDGET_LIMITS = {
  min: 2000,
  max: 200000,
};

export function clampBudget(budget) {
  if (!Number.isFinite(budget)) {
    return DEFAULT_CONTEXT_BUDGET;
  }
  return Math.min(BUDGET_LIMITS.max, Math.max(BUDGET_LIMITS.min, Math.round(budget)));
}

export function estimatedTokens(chars) {
  return Math.ceil(chars / 4);
}

export function fitsBudget(length, budget) {
  return length <= budget;
}

export function buildBudget({ budget = DEFAULT_CONTEXT_BUDGET, reserved = 0 } = {}) {
  const total = clampBudget(budget);
  return {
    total,
    remaining: Math.max(0, total - Math.max(0, reserved)),
    estimatedTokens: estimatedTokens(total),
  };
}