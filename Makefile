.PHONY: help kill run rerun up down logs ps build check-ports migrate migrate-mongo-okrs migrate-mongo-okrs-docker verify-pg-okrs

# Prefer docker-compose if installed; otherwise use docker compose.
COMPOSE := $(shell command -v docker-compose >/dev/null 2>&1 && echo docker-compose || echo "docker compose")
# macOS often has python3 but not python
PYTHON3 := $(shell command -v python3 2>/dev/null || command -v python 2>/dev/null || echo python3)

# Comprueba que el host tenga libres 3000 (frontend) y 5001 (backend) antes de levantar Docker.
check-ports:
	@if lsof -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "Error: el puerto 3000 está en uso (el frontend debe usar 3000). Proceso:"; \
		lsof -iTCP:3000 -sTCP:LISTEN; \
		echo "Cierra ese proceso (p. ej. kill PID) o para otro contenedor que use 3000."; \
		exit 1; \
	fi
	@if lsof -iTCP:5001 -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "Error: el puerto 5001 está en uso (el backend debe usar 5001)."; \
		lsof -iTCP:5001 -sTCP:LISTEN; \
		exit 1; \
	fi
	@echo "Puertos 3000 y 5001 libres."

help:
	@echo "Targets:"
	@echo "  make run    - Build and start all services (foreground)"
	@echo "  make kill   - Stop all services (docker compose down)"
	@echo "  make rerun  - kill + run (rebuild and start)"
	@echo "  make check-ports - Verifica que 3000 y 5001 estén libres en tu Mac"
	@echo "  make logs   - Follow logs"
	@echo "  make ps     - Show container status"
	@echo "  make migrate - Alembic upgrade head (backend container must be running)"
	@echo "  make migrate-mongo-okrs - Mongo->Postgres migration (host: needs python3 + pip install -r backend/requirements.txt)"
	@echo "  make migrate-mongo-okrs-docker - same, runs inside backend container (no local venv needed)"
	@echo "  make verify-pg-okrs - count objectives/key_results in compose Postgres (must match migrated data)"

kill: down

run: up

rerun: kill run

up: check-ports
	@$(COMPOSE) up --build

down:
	@$(COMPOSE) down --remove-orphans

build:
	@$(COMPOSE) build

logs:
	@$(COMPOSE) logs -f --tail=200

ps:
	@$(COMPOSE) ps

migrate:
	@$(COMPOSE) exec backend alembic upgrade head

migrate-mongo-okrs:
	cd backend && $(PYTHON3) migrate_mongo_okrs_to_postgres.py

migrate-mongo-okrs-docker:
	@$(COMPOSE) exec -T backend sh -c 'cd /app && python migrate_mongo_okrs_to_postgres.py'

verify-pg-okrs:
	@$(COMPOSE) exec -T postgres psql -U postgres -d okr -c "SELECT (SELECT COUNT(*) FROM objectives) AS objectives, (SELECT COUNT(*) FROM key_results) AS key_results;"
