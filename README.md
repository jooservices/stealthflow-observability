# StealthFlow Observability Microservice

Internal logging and observability microservice for the StealthFlow ecosystem.

**Copyright © 2025 Viet Vu / JOOservices**  
Email: [jooservices@gmail.com](mailto:jooservices@gmail.com) | Website: [https://jooservices.com](https://jooservices.com)

---

## 📖 Documentation

**[👉 Go to Complete Documentation](docs/README.md)**

### Quick Links
- **[Business Overview](docs/business/overview.md)** - Value & Functionality
- **[Deployment Guide](docs/guides/deployment.md)** - Installation & Setup
- **[API Reference](docs/api/reference.md)** - Endpoints & Schema
- **[User Guide](docs/guides/user-guide.md)** - Usage & Examples

---

## Quick Start

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
