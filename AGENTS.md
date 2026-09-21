# AGENTS.md - linkall

## Development Workflow

### Branching
- **NEVER commit to `main`** — always work on a branch
- Branch naming: `agent/<short-description>` (e.g., `agent/fix-contact-form`)
- Start from latest main: `git checkout main && git pull && git checkout -b agent/<description>`

### Development & Testing
1. Make changes on the branch
2. Run the project locally (dev server, build, etc.)
3. Verify changes work — check for console errors, broken builds
4. Take screenshots of the results
5. Save screenshots to `test-screenshots/` and commit them to the branch

### Screenshots — Required for UI Changes
- **Before/after** when modifying UI
- **Error states** if relevant
- Committed to branch in `test-screenshots/` — visible in PR file listing
- Also posted to Discord inline via `MEDIA:` directive

### Deployment Policy
- Push branch to origin
- Vercel and Convex use production deployments only; do not create preview deployments
- Vercel Git deployments are enabled only for `main` in each app's `vercel.json`
- GitHub deployment workflows run only from `main`, including manual runs
- Validate changes locally before PR review; verify production after an approved merge

### Pull Request
- Open PR from your branch → `main`
- Fill out the PR template completely
- Include local validation results; no preview URL is required
- Screenshots in `test-screenshots/` are visible in the PR

### Discord Delivery
When posting results to Discord, include:
- **Summary** of what was done
- **Screenshots** inline (`MEDIA:<path>`)
- **Production link** after deployment, when applicable
- **GitHub PR link**

### Production Deploy
- PR review → merge to `main` → Vercel auto-deploys to production
- Backend changes trigger the production Convex workflow after merge; check its result before considering any manual redeploy
- Delete branch after merge
