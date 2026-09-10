# MODCODES Release Process

**Version**: v0.1.0
**Date**: 2026-09-10

## Release Lifecycle

```
CODE → CI → VALIDATION → TAG → RELEASE → DEPLOY → VERIFY
```

## Pre-Release Checklist

Before creating a release, verify:

- [ ] Working tree is clean (`git status` shows nothing uncommitted)
- [ ] Version in `package.json` is correct
- [ ] All CI jobs pass (Lint, Build, Unit Tests, E2E Tests)
- [ ] `npm test` passes locally (880+ tests)
- [ ] `npm run lint` passes locally
- [ ] `npm run build` succeeds locally
- [ ] `npm run test:e2e` passes locally (if environment permits)
- [ ] No `npm audit` critical vulnerabilities in production dependencies
- [ ] Release notes are drafted
- [ ] Changelog is updated (if maintained)

## Release Steps

### 1. Update version

```bash
npm version <patch|minor|major> --no-git-tag-version
```

This updates `package.json` only. Do NOT let npm create a Git tag — we create it manually.

### 2. Commit version bump

```bash
git add package.json package-lock.json
git commit -m "chore(release): bump version to vX.Y.Z"
```

### 3. Run full validation

```bash
npm test && npm run lint && npm run build && npm run test:e2e
```

All must pass before proceeding.

### 4. Create Git tag

```bash
git tag vX.Y.Z
```

### 5. Push commit and tag

```bash
git push origin main --follow-tags
```

### 6. Create GitHub Release

1. Go to https://github.com/aryan-sonsurkar/mod-codes-ide/releases/new
2. Select the tag just pushed
3. Title: `MODCODES vX.Y.Z`
4. Describe what changed (use release notes)
5. Publish release

### 7. Verify deployment

1. Wait for Vercel to deploy (usually < 2 minutes)
2. Check `GET /api/health` returns correct version
3. Smoke test the application in browser
4. Verify no increase in error rate (browser console)

## Version Consistency

The canonical version source is `package.json`.

| Location | How it gets the version |
|----------|------------------------|
| `package.json` | Manual update via `npm version` |
| `/api/health` | Reads `process.env.npm_package_version` (set by npm) |
| Git tag | Created manually during release |
| GitHub Release | Created manually during release |

**Do NOT hardcode version numbers in source code.**

## Post-Release Verification

After deployment:

1. `GET /api/health` — version matches expected
2. Application loads without errors
3. Core features work (file open, editor, terminal, AI panel)
4. No new errors in browser console
5. E2E tests still pass in next CI run

## Rollback Procedure

If a release introduces a critical bug:

### Option A: Vercel rollback (fastest)

1. Go to Vercel dashboard → Deployments
2. Find the last known-good deployment
3. Click "..." → "Promote to Production"
4. Verify health endpoint shows old version

### Option B: Git revert

```bash
git revert <bad-commit-sha>
git push origin main
```

Vercel auto-deploys the reverted state.

### Option C: Re-deploy previous tag

```bash
git checkout vX.Y.Z
# Create a temporary branch or use Vercel's deploy from branch
```

### After rollback

1. Verify `GET /api/health` returns correct (previous) version
2. Smoke test the application
3. File an issue for the regression
4. Fix, test, and re-release when ready

## Emergency Hotfix Process

For critical production issues:

1. Create a branch from the last known-good tag:
   ```bash
   git checkout -b hotfix/vX.Y.Z vX.Y.Z
   ```
2. Apply minimal fix
3. Run full validation
4. Merge to main
5. Follow standard release steps

## Release Notes Format

```markdown
# MODCODES vX.Y.Z

## What's New
- ...

## Bug Fixes
- ...

## Known Issues
- ...

## Upgrade Notes
- ...
```

## Deployment Architecture

- **Platform**: Vercel
- **Trigger**: Push to `main` branch
- **Preview**: Automatic for PRs
- **Production**: Automatic on merge to `main`
- **Rollback**: Manual (Vercel dashboard or Git revert)

## Dependency Updates

For dependency upgrades:

1. Check `npm audit` for security issues
2. Run `npm test` before and after
3. Run `npm run build` before and after
4. Run `npm run test:e2e` if changes affect browser behavior
5. Commit lockfile changes with the update
6. Do NOT bundle unrelated changes with dependency updates
