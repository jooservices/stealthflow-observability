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

# Important: Accessing Internal Services

Since all infrastructure ports are now completely isolated (no external binding), you cannot access them directly from your host machine. This is by design for complete isolation.

## Accessing Kibana

To access Kibana UI, use port forwarding:

```bash
# Option 1: Port forward (temporary)
docker exec -it stealthflow-kibana sh -c "wget -O- http://localhost:5601"

# Option 2: SSH tunnel / kubectl port-forward style
docker run --rm --network observability-network alpine/curl:latest \
  curl http://stealthflow-kibana:5601
```

## Accessing Elasticsearch

```bash
# Query Elasticsearch from within the network
docker run --rm --network observability-network alpine/curl:latest \
  curl http://stealthflow-elasticsearch:9200/_cluster/health
```

## Accessing Redis

```bash
# Connect to Redis CLI
docker exec -it stealthflow-redis redis-cli ping
```

## Accessing MongoDB

```bash
# Connect to MongoDB shell
docker exec -it stealthflow-mongodb mongosh --eval "db.adminCommand('ping')"
```

## Why This Design?

**Complete Isolation**: No port conflicts with other containers or services on the host. Even if you have another Redis/ES/MongoDB container running on ports 6379/9200/27017, there will be NO conflict.

**Security**: Infrastructure services are only accessible via the internal Docker network, reducing attack surface.

**Production-Ready**: This mirrors production deployments where infrastructure services are never directly exposed.
