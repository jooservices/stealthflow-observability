# StealthFlow Observability Microservice

Internal logging and observability microservice for the StealthFlow ecosystem.

**Copyright © 2025 Viet Vu / JOOservices**  
Email: [jooservices@gmail.com](mailto:jooservices@gmail.com) | Website: [https://jooservices.com](https://jooservices.com)

---

## 📖 Documentation

> **⚠️ AI Guidance (First-Time Scan)**
> 
> **PRIORITY ORDER:**
> 1. **PRIMARY**: `docs/stealthflow-observability/` - Project documentation
> 2. **REFERENCE**: `docs/master/` - Shared standards
> 
> **Start here**: [docs/stealthflow-observability/00-index/README.md](docs/stealthflow-observability/00-index/README.md)

**[👉 Go to Complete Documentation](docs/README.md)**

### Quick Links (Project-Specific)
- **[System Overview](docs/stealthflow-observability/05-systems/stealthflow-observability/README.md)** - Value & Functionality
- **[Deployment Guide](docs/stealthflow-observability/05-systems/stealthflow-observability/operations/deployment.md)** - Installation & Setup
- **[API Reference](docs/stealthflow-observability/05-systems/stealthflow-observability/api/endpoints.md)** - Endpoints & Schema
- **[User Guide](docs/stealthflow-observability/07-guides/usage/user-guide.md)** - Usage & Examples
- **[Architecture Decisions](docs/stealthflow-observability/02-architecture/decisions/)** - ADRs

---

## Quick Start

> **Important:** Use Docker Compose V2 (`docker compose`). The legacy `docker-compose` binary breaks with newer Docker Engine versions and triggers `KeyError: 'ContainerConfig'` during `up`. Replace any `docker-compose` commands with `docker compose`.

### 1. Automated Deployment
Run the deployment script to set up the entire stack:
```bash
./scripts/deploy.sh
```
This will:
- Check for existing containers and offer to reuse or clean them.
- Generate API keys in `.env`.
- Start all services (Redis, Elasticsearch, MongoDB, API, Worker, Kibana).
- Verify health and display credentials.

### 2. Run Demo & Verify
Run the demo script to verify everything is working and flood test data:
```bash
./scripts/demo.sh
```
This will:
- Verify the deployment.
- Send 100+ sample logs to the API.
- Guide you to view the data in Kibana.

### 3. Access Interfaces
- **API**: http://localhost:3100
- **Kibana**: http://localhost:5601

### 4. Cleanup
To stop services and optionally remove data/images:
```bash
./scripts/cleanup.sh
```

---

## 🏗 Architecture

```
Application → API Server → Redis Stream → LogWorker → Elasticsearch → Kibana
```

*See [Architecture](docs/development/architecture.md) for details.*

---

## 📄 License

MIT

**Copyright © 2025 Viet Vu / JOOservices**
