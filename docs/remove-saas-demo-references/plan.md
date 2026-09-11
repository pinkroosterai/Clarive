# Plan: Remove SaaS and Online Demo References

**Goal** — Audit all repository markdown files and eliminate any phrasing implying a paid hosted SaaS or online demo version, ensuring Clarive documentation consistently presents it as 100% self-hosted FOSS.
**Status** — not started
**Research** — `research.md`

## Context

Clarive is 100% a self-hosted FOSS service. Audit of all 9 markdown files in the codebase confirmed there are no active paid SaaS offerings or online demo links. However, minor documentation phrasing in `docs/configuration.md` (e.g. `(self-host only)` parenthetical on environment variables) implies the existence of non-self-hosted alternatives. Updating these phrasings eliminates ambiguity.

## Phase 1 — Clean up configuration documentation phrasing

**Status** — not started
**Rests on** — `docs/configuration.md` line 28 and line 73 hold the target phrasing identified in `research.md`.
**Settle first** — Nothing.
**Tasks**
- [ ] Remove `(self-host only)` parenthetical from `CLARIVE_VERSION` row — file is `docs/configuration.md`
- [ ] Update email provider `none` description to remove "for self-hosted setups" phrasing — file is `docs/configuration.md`
**Done when** — `git grep -i "self-host only"` returns zero results across all markdown files.

## Log

