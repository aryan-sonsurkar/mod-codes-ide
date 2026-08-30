# Git Safety — MODCODES

Adaptive: `clean+small → normal`, `uncommitted overlap → warn`, `large/high-risk → recommend checkpoint`, `destructive/rewrite → explicit approval`. Never auto-push, silent commit, discard, reset without approval. GitHub repo creation offered at New Project (`githubRepo` flag). Implemented in `lib/git/safety.js` `gitSafetyLevel` + message.
