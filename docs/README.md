---
title: "Documentation Index"
type: "index"
scope: "project"
project: "stealthflow-observability"
what: "Main documentation index with AI guidance and structure overview"
why: "Provide entry point and navigation for documentation"
how: "Start here to understand documentation structure"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['navigation', 'index', 'documentation', 'stealthflow-observability']
ai_semantics:
  layer: "navigation"
  relates_to: ['documentation', 'navigation']
---

# Documentation

## ⚠️ AI First-Time Scan Instructions

**For AI tools scanning this codebase:**

### Discovery Priority
1. **HIGH PRIORITY**: `stealthflow-observability/` - Project documentation
2. **LOW PRIORITY**: `master/` - Shared standards (submodule, reference only)

### Entry Points
- **Start here**: [stealthflow-observability/00-index/README.md](stealthflow-observability/00-index/README.md)
- **System docs**: [stealthflow-observability/05-systems/stealthflow-observability/](stealthflow-observability/05-systems/stealthflow-observability/)

## Structure

### 📚 Project Documentation - **PRIMARY**
[stealthflow-observability/](stealthflow-observability/) - Project-specific documentation

### 📖 Master Standards - **REFERENCE**
[master/](master/) - Enterprise standards (submodule from architecture-center)

## Quick Links

### Project-Specific (Use These)
- [System Overview](stealthflow-observability/05-systems/stealthflow-observability/README.md)
- [Architecture](stealthflow-observability/05-systems/stealthflow-observability/architecture.md)
- [API Documentation](stealthflow-observability/05-systems/stealthflow-observability/api/endpoints.md)
- [Deployment Guide](stealthflow-observability/05-systems/stealthflow-observability/operations/deployment.md)
- [Monitoring](stealthflow-observability/05-systems/stealthflow-observability/operations/monitoring.md)
- [Troubleshooting](stealthflow-observability/05-systems/stealthflow-observability/runbooks/troubleshooting.md)
- [Architecture Decisions](stealthflow-observability/02-architecture/decisions/)

### Standards (Reference Only)
- [API Standard](master/03-technical/standards/api-standard.md)
- [Logging Standard](master/03-technical/standards/logging-standard.md)
- [Testing Standard](master/03-technical/standards/testing-standard.md)
- [Metadata Standard](master/08-meta/metadata-standard.md)

## Documentation Structure

### Project Documentation (`stealthflow-observability/`)
- `00-index/` - Navigation and discovery hub
- `02-architecture/decisions/` - Architecture Decision Records (ADRs)
- `05-systems/stealthflow-observability/` - System documentation
  - `api/` - API endpoints, payloads, error handling
  - `operations/` - Deployment, monitoring, scaling
  - `runbooks/` - Troubleshooting guides
  - `workflows/` - Workflow documentation
- `07-guides/` - User-facing guides
  - `onboarding/` - Setup and installation
  - `usage/` - How to use the service

### Master Standards (`master/`)
- `03-technical/standards/` - API, logging, testing standards
- `08-meta/` - Documentation governance and templates

## Compliance

All project documentation follows:
- ✅ [API Standard](master/03-technical/standards/api-standard.md)
- ✅ [Logging Standard](master/03-technical/standards/logging-standard.md)
- ✅ [Metadata Standard](master/08-meta/metadata-standard.md)
