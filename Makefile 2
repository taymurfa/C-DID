.PHONY: help kill run rerun up down logs ps build

# Prefer docker-compose if installed; otherwise use docker compose.
COMPOSE := $(shell command -v docker-compose >/dev/null 2>&1 && echo docker-compose || echo "docker compose")

help:
	@echo "Targets:"
	@echo "  make run    - Build and start all services (foreground)"
	@echo "  make kill   - Stop all services (docker compose down)"
	@echo "  make rerun  - kill + run (rebuild and start)"
	@echo "  make logs   - Follow logs"
	@echo "  make ps     - Show container status"

kill: down

run: up

rerun: kill run

up:
	@$(COMPOSE) up --build

down:
	@$(COMPOSE) down --remove-orphans

build:
	@$(COMPOSE) build

logs:
	@$(COMPOSE) logs -f --tail=200

ps:
	@$(COMPOSE) ps
