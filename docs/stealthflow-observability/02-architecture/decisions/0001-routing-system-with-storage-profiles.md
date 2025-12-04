---
title: "Routing System with Storage Profiles"
type: "adr"
scope: "project"
project: "stealthflow-observability"
status: "accepted"
date: "2025-12-05"
what: "Architecture decision to implement 3-layer routing system"
why: "Separate concerns: envelope, routing rules, storage profiles"
how: "Implement storage profiles and routing rules as separate layers"
owner: "StealthFlow Team"
last_updated: "2025-12-05"
tags: ['architecture', 'routing', 'storage', 'adr']
ai_semantics:
  layer: "architecture"
  scope: "project"
  project: "stealthflow-observability"
  relates_to: ['routing', 'storage', 'architecture']
---

# 1. Routing System with Storage Profiles

## Status
Accepted

## Context
We need a flexible log routing system that can:
- Route logs to different storage backends (Elasticsearch, MongoDB)
- Apply different retention policies (TTL)
- Support pattern-based routing (by category, kind, level)
- Maintain separation of concerns

## Decision
Implement a 3-layer architecture:
1. **Log Envelope** - Log payload structure (schema v2)
2. **Routing Rules** - Logic to determine storage profile (no backend knowledge)
3. **Storage Profiles** - Map profile names to actual backends

## Consequences

### Positive
- ✅ Clear separation of concerns
- ✅ Easy to add new storage backends
- ✅ Routing rules don't know about Elasticsearch/MongoDB
- ✅ Storage profiles are the only place mentioning backends
- ✅ Supports dual-write (CRITICAL_DUAL profile)
- ✅ Pattern-based routing (category, kind, level)

### Negative
- ⚠️ More files to maintain (routingRules.js, storageProfiles.js)
- ⚠️ Need to understand 3 layers instead of 1

## Implementation
- `src/config/storageProfiles.js` - Storage profile definitions
- `src/config/routingRules.js` - Routing rules with priority
- `src/config/routing.js` - Backward compatible wrapper

## References
- [System Architecture](../05-systems/stealthflow-observability/architecture.md)
- [API Reference](../05-systems/stealthflow-observability/api/endpoints.md)
