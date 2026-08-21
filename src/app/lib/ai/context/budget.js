export const DEFAULT_CONTEXT_BUDGET = 24000;

export const BUDGET_LIMITS = {
  min: 2000,
  max: 200000,
};

export const TOKENS_TO_CHARS = 4;

export const DEFAULT_OUTPUT_BUDGET_TOKENS = 2048;
export const DEFAULT_HISTORY_BUDGET_TOKENS = 4096;
export const DEFAULT_HEADROOM_RATIO = 0.8;

export function clampBudget(budget) {
  if (!Number.isFinite(budget)) {
    return DEFAULT_CONTEXT_BUDGET;
  }
  return Math.min(BUDGET_LIMITS.max, Math.max(BUDGET_LIMITS.min, Math.round(budget)));
}

export function estimatedTokens(chars) {
  return Math.ceil(chars / TOKENS_TO_CHARS);
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

export function budgetForModel(
  model = null,
  {
    outputBudget = DEFAULT_OUTPUT_BUDGET_TOKENS,
    historyBudget = DEFAULT_HISTORY_BUDGET_TOKENS,
    headroomRatio = DEFAULT_HEADROOM_RATIO,
  } = {}
) {
  const contextLength =
    model && Number.isFinite(model.contextLength) && model.contextLength > 0
      ? model.contextLength
      : null;

  if (!contextLength) {
    return {
      budget: DEFAULT_CONTEXT_BUDGET,
      contextLength: null,
      limitedBy: null,
    };
  }

  const reservedTokens =
    (Number.isFinite(outputBudget) && outputBudget > 0 ? outputBudget : 0) +
    (Number.isFinite(historyBudget) && historyBudget > 0 ? historyBudget : 0);
  const usableChars = Math.max(
    0,
    Math.floor(contextLength * headroomRatio) * TOKENS_TO_CHARS
  );
  const budget = clampBudget(usableChars - reservedTokens * TOKENS_TO_CHARS);

  return {
    budget,
    contextLength,
    limitedBy: contextLength,
  };
}