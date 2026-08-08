.PHONY: help kill run rerun up down logs ps build

# Prefer docker-compose if installed; otherwise use docker compose.
COMPOSE := $(shell command -v docker-compose >/dev/null 2>&1 && echo docker-compose || echo "docker compose")

help:
	@echo "Speaker Signal targets:"
	@echo "  make run   - Build and start the stack (dashboard :3000, agents :8001-:8003)"
	@echo "  make kill  - Stop all services"
	@echo "  make rerun - kill + run"
	@echo "  make logs  - Follow logs"
	@echo "  make ps    - Show container status"
	@echo ""
	@echo "GTM SMTP (Zoho) is driven by root .env: SEND_MODE, SMTP_*"
	@echo "  curl http://localhost:8003/mail/status"
	@echo "  curl -X POST http://localhost:8003/mail/test -H 'content-type: application/json' -d '{\"to\":\"you@example.com\"}'"

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
