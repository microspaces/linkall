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

### Preview Deployment
- Push branch to origin
- Vercel auto-creates a preview deployment on branch push
- If using Convex: push preview deployment (`npx convex deploy --preview-run` or rely on Vercel integration)
- Capture the preview URL for the PR and Discord

### Pull Request
- Open PR from your branch → `main`
- Fill out the PR template completely
- Include preview URL
- Screenshots in `test-screenshots/` are visible in the PR

### Discord Delivery
When posting results to Discord, include:
- **Summary** of what was done
- **Screenshots** inline (`MEDIA:<path>`)
- **Vercel preview link**
- **GitHub PR link**

### Production Deploy
- PR review → merge to `main` → Vercel auto-deploys to production
- For Convex repos: run `npx convex deploy` after merge if backend changes were made
- Delete branch after merge
