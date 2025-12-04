---
title: "Pull Request Template"
type: "template"
what: "Pull Request Template overview."
why: "Clarifies intent and expectations for this document."
how: "Use this template to capture decisions, standards, and guidance."
owner: "Docs Team"
status: "draft"
last_updated: "2025-01-01"
tags: ['governance']
ai_semantics:
  layer: "governance"
  relates_to: []
---

## Summary
- Why: _What problem are we solving?_
- What: _Concise description of the change (link related issues/ADRs/RFCs)._

## Scope
- Affected areas: _List key docs/sections touched._
- Out of scope: _Call out what is explicitly not covered._

## Validation
- [ ] Previewed locally (e.g., `mkdocs serve` or static preview)
- [ ] Links checked
- [ ] Metadata present and up to date
- [ ] Tests run (if applicable to docs tooling/scripts)
- [ ] Secret scan run (no tokens/keys committed)

## Checklist
- [ ] Changes align with docs style guide
- [ ] Relevant ADR/RFC references added
- [ ] Changelog updated if needed (`docs/00-index/changelog.md`)
- [ ] Owners/reviewers notified
- [ ] Conventional Commit used for the title (e.g., `docs: update principles`)
