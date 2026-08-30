"use client";

export function gitSafetyLevel({ hasUncommitted, affectedOverlap, isLargeTask, isDestructive }) {
  if (isDestructive) return "explicit-approval";
  if (isLargeTask) return "recommend-checkpoint";
  if (hasUncommitted && affectedOverlap) return "warn-overlap";
  return "normal";
}

export function gitSafetyMessage(level) {
  switch (level) {
    case "explicit-approval": return "Destructive/rewrite operation — explicit approval required. Will not auto-push or discard changes.";
    case "recommend-checkpoint": return "Large/high-risk task — recommend creating a Git checkpoint before proceeding.";
    case "warn-overlap": return "Uncommitted changes overlap affected files — warn and allow review.";
    default: return "Clean repo / small task — work normally.";
  }
}
