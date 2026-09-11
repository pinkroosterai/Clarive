# Research: Remove SaaS and Online Demo References

Checked 2026-09-11. Feeds `plan.md`.

## Analysis of Markdown Files for SaaS and Demo References

All 9 markdown files in the repository were scanned and analyzed for any references to paid hosted SaaS versions, online demo instances, or phrasing implying a managed/SaaS option.

Files audited:
- `README.md`
- `CHANGELOG.md`
- `docs/architecture.md`
- `docs/configuration.md`
- `docs/contributing.md`
- `docs/deployment-guide.md`
- `docs/development-setup.md`
- `docs/migration-unified-image.md`
- `.github/PULL_REQUEST_TEMPLATE.md`

### Findings

1. **`docs/configuration.md` (Line 28)**:
   - Current text: `| CLARIVE_VERSION | Docker Hub image tag (self-host only) | latest |`
   - Issue: The `(self-host only)` parenthetical implies the existence of a managed/SaaS version where `CLARIVE_VERSION` would not apply.
   - Resolution: Update description to `Docker Hub image tag`.

2. **`docs/configuration.md` (Line 73)**:
   - Current text: `- **`none`** (default) — No emails sent. New users are auto-verified. Works fine for self-hosted setups that don't need email.`
   - Issue: Phrasing "self-hosted setups" implies contrasting cloud/SaaS setups.
   - Resolution: Simplify to `Works fine for setups that don't need email.`

3. **No Direct References Found**:
   - No URLs to `demo.clarive.com`, `app.clarive.com`, or online demo instances exist in any `.md` files.
   - No pricing plans, SaaS subscription tiers, or paid version references exist for Clarive itself.
   - `README.md` explicitly states: "Self-hosted. Single container. MIT licensed." and "MIT licensed with no open-core traps and no enterprise keys gating features you need."

## Ruled out

- **Removing competitor comparison table "Paid" labels in README.md** — The table compares Clarive (FOSS, "Yes") against third-party SaaS competitors (Langfuse, PromptLayer, Agenta) which charge ("Paid") for Team RBAC. This clarifies Clarive's FOSS status rather than suggesting Clarive is paid.

## Still open

- None.
