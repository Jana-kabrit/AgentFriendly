# Contributing to AgentFriendly

Thank you for your interest in contributing. To keep the codebase stable and maintainable, we use a controlled contribution workflow.

---

## Contribution Policy

### Direct pushes to `main` are disabled

**Nobody can push directly to `main`.** All changes must go through a Pull Request (PR). This applies to everyone, including repository maintainers.

### Pull Request requirements

Before a PR can be merged:

1. **CI must pass** — All tests (TypeScript + Python) and type checks must succeed.
2. **At least one approval** — A designated maintainer must review and approve the PR.
3. **No merge conflicts** — The branch must be up to date with `main`.
4. **PR template completed** — All checklist items in the PR template must be addressed.

### What gets reviewed

Maintainers will review for:

- Correctness and alignment with the SDK’s architecture
- Test coverage for new or changed behavior
- Breaking changes (these require an ADR and a major version bump)
- Security implications (especially in detection, access control, and multi-tenancy layers)
- Documentation updates when behavior or APIs change

---

## For Contributors

### Before you start

1. **Open an issue first** for larger changes (new features, breaking changes, new packages). This helps align on approach before you invest time.
2. **Check existing issues and PRs** to avoid duplicate work.
3. **Read the relevant docs** in `docs/architecture/` and `docs/adr/` so your changes fit the design.

### How to submit a change

1. **Fork the repository** (or create a branch if you have write access).
2. **Create a branch** from `main`:
   ```
   git checkout main
   git pull origin main
   git checkout -b feat/your-feature-name
   # or: fix/description-of-bug
   ```
3. **Make your changes** — follow the code style and testing guidelines below.
4. **Run the test suite locally**:
   ```
   pnpm install
   pnpm build
   pnpm test
   pnpm typecheck
   ```
5. **Commit** with clear, conventional messages:
   ```
   feat(core): add support for custom PII patterns
   fix(express): handle missing Content-Type in HTML interception
   docs: update detection layer architecture
   ```
6. **Push** and open a Pull Request against `main`.
7. **Fill out the PR template** and wait for review.

### Code style

- **TypeScript**: ESLint + Prettier (config in repo root). Run `pnpm lint` and `pnpm format`.
- **Python**: Ruff + type hints. Follow existing patterns in `python_sdk/`.
- **Tests**: New behavior should have tests. For core logic, prefer unit tests in the relevant package. For integration, add E2E tests in `packages/core/tests/e2e/`.
- **Documentation**: Update `docs/` and/or `docs-site/` when you change behavior, config, or APIs.

### What we welcome

- Bug fixes
- Documentation improvements
- New UA database entries (`packages/ua-database/data/agents.json`)
- Performance optimizations that don’t change behavior
- New framework adapters (discuss in an issue first)
- Well-scoped feature additions that fit the existing architecture

### What we’re cautious about

- Breaking changes to config, exports, or public APIs
- New dependencies (prefer small, well-maintained packages)
- Changes to detection, access control, or crypto logic (extra scrutiny)

---

## For Repository Maintainers

### Branch protection (required)

Configure in **GitHub → Settings → Branches → Branch protection rules** for `main`:

| Setting                                                          | Recommended value                     |
| ---------------------------------------------------------------- | ------------------------------------- |
| Require a pull request before merging                            | ✅ Yes                                |
| Require approvals                                                | 1 (or more for sensitive paths)       |
| Dismiss stale pull request approvals when new commits are pushed | ✅ Yes                                |
| Require status checks to pass before merging                     | ✅ Yes                                |
| Require branches to be up to date before merging                 | ✅ Yes                                |
| Status checks required                                           | `build` (or your CI job name), `test` |
| Do not allow bypassing the above settings                        | ✅ Yes (including admins)             |
| Restrict who can push to matching branches                       | Optional: restrict to a specific team |

### CODEOWNERS

The repository includes `.github/CODEOWNERS`. **Update it** with the GitHub usernames or teams that should approve changes. By default, all paths require maintainer approval. Adjust the file if you want different owners for different areas (e.g., `python_sdk/` vs `packages/core/`).

### Requiring CODEOWNERS review

In branch protection, enable **“Require review from Code Owners”** so that PRs cannot be merged without approval from the people listed in `CODEOWNERS`.

---

## Security

For **security vulnerabilities**, do not open a public issue. Contact the maintainers privately (e.g., via GitHub Security Advisories or the repository’s security contact). We’ll respond and coordinate a fix and disclosure.

---

## Questions

If you’re unsure about the contribution process or whether a change fits the project, open a **Discussion** or an **Issue** and we’ll clarify.
