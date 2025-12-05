---
title: "Accessing Internal Services"
type: "system-doc"
scope: "project"
project: "stealthflow-observability"
what: "Guide for accessing internal services (Redis, Elasticsearch, etc.)"
why: "Help developers access infrastructure services"
how: "Follow instructions to access services"
owner: "StealthFlow Team"
status: "approved"
last_updated: "2025-12-05"
tags: ['operations', 'infrastructure', 'stealthflow-observability']
ai_semantics:
  layer: "system"
  relates_to: ['operations', 'infrastructure']
---

# Accessing Internal Services

Only the API (`3100`) and Kibana (`5601`) are exposed to the host. Redis, Elasticsearch, and MongoDB stay on the internal Docker network. Use `docker exec` or a throwaway container on the same network to reach them.

## Kibana (exposed)
- URL: `http://localhost:5601`
- Health: `docker exec stealthflow-kibana curl -s http://localhost:5601/api/status`

## Elasticsearch (internal)
```bash
# Cluster health
docker exec stealthflow-elasticsearch curl -s http://localhost:9200/_cluster/health

# Index stats (use LOG_INDEX_ALIAS)
docker exec stealthflow-elasticsearch curl -s http://localhost:9200/${LOG_INDEX_ALIAS:-stealthflow_develop_logs}/_stats

# List indices
docker exec stealthflow-elasticsearch curl -s http://localhost:9200/_cat/indices

# Sample search (recent docs)
docker exec stealthflow-elasticsearch curl -s -H 'Content-Type: application/json' \
  -XGET "http://localhost:9200/${LOG_INDEX_ALIAS:-stealthflow_develop_logs}/_search" \
  -d '{ "size": 5, "sort": [{"timestamp": {"order": "desc"}}] }'
```

## Redis (internal)
```bash
docker exec -it stealthflow-redis redis-cli ping
docker exec -it stealthflow-redis redis-cli XLEN logs:stream
docker exec -it stealthflow-redis redis-cli XLEN logs:failed

# Peek latest entries
docker exec -it stealthflow-redis redis-cli XREVRANGE logs:stream + - COUNT 5
docker exec -it stealthflow-redis redis-cli XREVRANGE logs:failed + - COUNT 5
```

## MongoDB (internal)
```bash
docker exec -it stealthflow-mongodb mongosh --eval "db.adminCommand('ping')"

# List collections
docker exec -it stealthflow-mongodb mongosh observability --eval "db.getCollectionNames()"

# View one document from a profile collection
docker exec -it stealthflow-mongodb mongosh observability --eval "db.logs_critical.findOne({}, {log_id:1,timestamp:1,service:1,event:1})"
```

## Running a one-off helper inside the network
```bash
docker run --rm --network observability-net alpine/curl \
  curl http://stealthflow-elasticsearch:9200/_cluster/health
```

## Notes
- Keep Redis/Elasticsearch/MongoDB internal in all environments; expose only the API (and Kibana if required).
- If you need temporary host access to an internal service, prefer `docker exec` instead of binding new ports.
