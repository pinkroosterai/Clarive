.PHONY: help setup dev stop restart dev-reset logs status \
       deploy undeploy build-image \
       build build-frontend build-backend \
       test test-frontend test-backend test-filter test-e2e test-e2e-up test-e2e-down test-e2e-ui lint clean \
       db-shell db-migrate db-migration-add db-reset \
       _require-docker _require-sdk

SHELL   := /bin/bash
ROOT    := $(shell pwd)
FE_DIR  := $(ROOT)/src/frontend
BE_DIR  := $(ROOT)/src/backend/Clarive.Api
DEPLOY  := $(ROOT)/deploy

# Dev compose (all Docker, hot reload via volume mounts)
DEV_COMPOSE = docker compose -p clarive-dev --env-file $(ROOT)/.env -f $(DEPLOY)/docker-compose.yml -f $(DEPLOY)/docker-compose.dev.yml

# Production compose (appends local override if present, e.g. for proxy network)
PROD_COMPOSE = docker compose -p clarive --env-file $(DEPLOY)/.env -f $(DEPLOY)/docker-compose.yml $(if $(wildcard $(DEPLOY)/docker-compose.local.yml),-f $(DEPLOY)/docker-compose.local.yml)

# E2E test compose (isolated stack with seed data, non-conflicting ports)
E2E_COMPOSE = docker compose -p clarive-e2e --env-file $(DEPLOY)/.env.e2e -f $(DEPLOY)/docker-compose.yml -f $(DEPLOY)/docker-compose.e2e.yml

# Colors
C_RESET  := \033[0m
C_GREEN  := \033[32m
C_YELLOW := \033[33m
C_CYAN   := \033[36m
C_RED    := \033[31m
C_BOLD   := \033[1m
C_DIM    := \033[2m

## —— Clarive ——————————————————————————————————————————————

help: ## Show this help
	@printf "$(C_BOLD)$(C_CYAN)Clarive$(C_RESET) — development & deployment commands\n\n"
	@printf "$(C_BOLD)QUICK START$(C_RESET)\n"
	@printf "  $(C_DIM)Development:$(C_RESET)  make setup → make dev\n"
	@printf "  $(C_DIM)Production:$(C_RESET)   make setup → make deploy\n\n"
	@printf "$(C_BOLD)DEVELOPMENT$(C_RESET)\n"
	@grep -E '^(dev|stop|restart|dev-reset|logs|status):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(C_GREEN)%-28s$(C_RESET) %s\n", $$1, $$2}'
	@echo ""
	@printf "$(C_BOLD)DEPLOYMENT$(C_RESET)\n"
	@grep -E '^(setup|deploy|undeploy|build-image):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(C_GREEN)%-28s$(C_RESET) %s\n", $$1, $$2}'
	@echo ""
	@printf "$(C_BOLD)DATABASE$(C_RESET)\n"
	@grep -E '^db-[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(C_GREEN)%-28s$(C_RESET) %s\n", $$1, $$2}'
	@echo ""
	@printf "$(C_BOLD)BUILD / TEST$(C_RESET)\n"
	@grep -E '^(build|test|lint|clean)[a-z-]*:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(C_GREEN)%-28s$(C_RESET) %s\n", $$1, $$2}'
	@echo ""

## —— Prerequisites ————————————————————————————————————————

_require-docker:
	@command -v docker >/dev/null 2>&1 || { \
		printf "$(C_RED)Error: docker is not installed.$(C_RESET)\n"; \
		printf "  Install: $(C_CYAN)https://docs.docker.com/get-docker/$(C_RESET)\n"; \
		exit 1; \
	}
	@docker compose version >/dev/null 2>&1 || { \
		printf "$(C_RED)Error: docker compose (v2) is not available.$(C_RESET)\n"; \
		printf "  Install: $(C_CYAN)https://docs.docker.com/compose/install/$(C_RESET)\n"; \
		exit 1; \
	}
	@docker info >/dev/null 2>&1 || { \
		printf "$(C_RED)Error: Docker daemon is not running.$(C_RESET)\n"; \
		printf "  Start it with: $(C_CYAN)sudo systemctl start docker$(C_RESET)\n"; \
		exit 1; \
	}

_require-sdk:
	@command -v dotnet >/dev/null 2>&1 || { \
		printf "$(C_RED)Error: dotnet SDK is not installed.$(C_RESET)\n"; \
		printf "  Install: $(C_CYAN)https://dot.net/download$(C_RESET)\n"; \
		exit 1; \
	}
	@command -v node >/dev/null 2>&1 || { \
		printf "$(C_RED)Error: Node.js is not installed.$(C_RESET)\n"; \
		printf "  Install: $(C_CYAN)https://nodejs.org/$(C_RESET)\n"; \
		exit 1; \
	}
	@command -v npm >/dev/null 2>&1 || { \
		printf "$(C_RED)Error: npm is not installed.$(C_RESET)\n"; \
		printf "  Install Node.js which includes npm: $(C_CYAN)https://nodejs.org/$(C_RESET)\n"; \
		exit 1; \
	}

## —— Setup ————————————————————————————————————————————————

setup: ## Generate .env (dev) and deploy/.env (prod) with random secrets
	@bash $(ROOT)/scripts/setup.sh

## —— Development (all Docker, hot reload) ————————————————

dev: _require-docker ## Start all services with hot reload
	@printf "$(C_CYAN)Starting development environment...$(C_RESET)\n"
	@$(DEV_COMPOSE) up --build --force-recreate -d
	@printf "\n$(C_BOLD)$(C_GREEN)Development environment ready.$(C_RESET)\n"
	@printf "  App:    $(C_CYAN)http://localhost:8080$(C_RESET)\n"
	@printf "  Logs:   $(C_YELLOW)make logs$(C_RESET)\n"
	@printf "  Stop:   $(C_YELLOW)make stop$(C_RESET)\n\n"

stop: ## Stop development services
	@$(DEV_COMPOSE) down
	@printf "$(C_GREEN)Development environment stopped.$(C_RESET)\n"

restart: _require-docker ## Restart development services
	@$(DEV_COMPOSE) down
	@$(DEV_COMPOSE) up --build -d
	@printf "$(C_GREEN)Development environment restarted.$(C_RESET)\n"

dev-reset: _require-docker ## Stop, wipe database, and restart fresh
	@printf "$(C_RED)This will destroy all development database data. Continue? [y/N] $(C_RESET)"
	@read -r ans; \
	if [ "$$ans" = "y" ] || [ "$$ans" = "Y" ]; then \
		$(DEV_COMPOSE) down -v; \
		printf "$(C_CYAN)Starting fresh environment...$(C_RESET)\n"; \
		$(DEV_COMPOSE) up --build --force-recreate -d; \
		printf "\n$(C_BOLD)$(C_GREEN)Fresh development environment ready.$(C_RESET)\n"; \
		printf "  App:    $(C_CYAN)http://localhost:8080$(C_RESET)\n\n"; \
	else \
		printf "$(C_YELLOW)Cancelled.$(C_RESET)\n"; \
	fi

logs: ## Tail development service logs
	@$(DEV_COMPOSE) logs -f

status: ## Show running containers and health status
	@printf "$(C_BOLD)Development$(C_RESET)\n"
	@$(DEV_COMPOSE) ps 2>/dev/null || printf "  $(C_DIM)Not running$(C_RESET)\n"
	@echo ""
	@printf "$(C_BOLD)Production$(C_RESET)\n"
	@$(PROD_COMPOSE) ps 2>/dev/null || printf "  $(C_DIM)Not running$(C_RESET)\n"

## —— Deployment (production) —————————————————————————————

deploy undeploy build-image: ## → Managed by ClariveDeployServer
	@printf "$(C_RED)Server deployment has moved to ClariveDeployServer.$(C_RESET)\n"
	@printf "  $(C_CYAN)cd /home/najgeetsrev/ClariveDeployServer && ./deploy.sh clarive <dev|prod>$(C_RESET)\n"

## —— Database ———————————————————————————————————————————

db-shell: ## Open psql shell (auto-detects dev or prod)
	@CONTAINER=$$(docker ps --format '{{.Names}}' --filter name=clarive.*postgres | head -1); \
	if [ -z "$$CONTAINER" ]; then \
		printf "$(C_RED)No running Postgres container found.$(C_RESET)\n"; \
		printf "  Start one with $(C_GREEN)make dev$(C_RESET) or $(C_GREEN)make deploy$(C_RESET)\n"; \
		exit 1; \
	fi; \
	printf "$(C_CYAN)Connecting to $$CONTAINER...$(C_RESET)\n"; \
	docker exec -it "$$CONTAINER" psql -U clarive -d clarive

db-migrate: _require-sdk ## Apply EF Core migrations (requires dotnet SDK)
	@printf "$(C_CYAN)Applying EF Core migrations...$(C_RESET)\n"
	@cd $(BE_DIR) && dotnet ef database update
	@printf "$(C_GREEN)Migrations applied.$(C_RESET)\n"

db-migration-add: _require-sdk ## Create a new migration. Usage: make db-migration-add NAME=MyMigration
	@if [ -z "$(NAME)" ]; then \
		printf "$(C_RED)Usage: make db-migration-add NAME=MigrationName$(C_RESET)\n"; \
		exit 1; \
	fi
	@printf "$(C_CYAN)Creating migration '$(NAME)'...$(C_RESET)\n"
	@cd $(BE_DIR) && \
		CONNECTIONSTRINGS__DEFAULTCONNECTION="Host=localhost;Database=clarive;Username=x;Password=x" \
		JWT__SECRET="placeholder-secret-for-migration-generation-only-32chars!" \
		dotnet ef migrations add $(NAME) --output-dir Data/Migrations
	@printf "$(C_GREEN)Migration created.$(C_RESET)\n"

db-reset: ## Destroy and recreate database volume (with confirmation)
	@printf "$(C_RED)This will destroy ALL database data (dev + prod). Continue? [y/N] $(C_RESET)"
	@read -r ans; \
	if [ "$$ans" = "y" ] || [ "$$ans" = "Y" ]; then \
		$(DEV_COMPOSE) down -v 2>/dev/null || true; \
		$(PROD_COMPOSE) down -v 2>/dev/null || true; \
		printf "$(C_GREEN)Database volumes removed. Run 'make dev' or 'make deploy' to recreate.$(C_RESET)\n"; \
	else \
		printf "$(C_YELLOW)Cancelled.$(C_RESET)\n"; \
	fi

## —— Build / Test ————————————————————————————————————————

build: _require-sdk build-frontend build-backend ## Build both projects (local, no Docker)

build-frontend: _require-sdk ## Build frontend for production
	@printf "$(C_CYAN)Building frontend...$(C_RESET)\n"
	@cd $(FE_DIR) && npm run build
	@printf "$(C_GREEN)Frontend built.$(C_RESET)\n"

build-backend: _require-sdk ## Build backend
	@printf "$(C_CYAN)Building backend...$(C_RESET)\n"
	@cd $(BE_DIR) && dotnet build --configuration Release --nologo -v q
	@printf "$(C_GREEN)Backend built.$(C_RESET)\n"

test: _require-sdk ## Run all tests (frontend + backend)
	@$(MAKE) --no-print-directory test-frontend
	@$(MAKE) --no-print-directory test-backend

test-frontend: _require-sdk ## Run frontend tests (vitest)
	@printf "$(C_CYAN)Running frontend tests...$(C_RESET)\n"
	@cd $(FE_DIR) && npx vitest run --passWithNoTests

test-backend: _require-sdk ## Run backend unit + integration tests
	@printf "$(C_CYAN)Running backend unit tests...$(C_RESET)\n"
	@cd $(ROOT)/tests/backend/Clarive.Api.UnitTests && dotnet test --nologo --verbosity normal
	@printf "$(C_CYAN)Running backend integration tests...$(C_RESET)\n"
	@cd $(ROOT)/tests/backend/Clarive.Api.IntegrationTests && dotnet test --nologo --verbosity normal

test-filter: _require-sdk ## Run filtered tests. Usage: make test-filter FILTER=Auth
	@if [ -z "$(FILTER)" ]; then \
		printf "$(C_RED)Usage: make test-filter FILTER=ClassName$(C_RESET)\n"; \
		exit 1; \
	fi
	@printf "$(C_CYAN)Running tests matching '$(FILTER)'...$(C_RESET)\n"
	@cd $(ROOT)/tests/backend/Clarive.Api.UnitTests && dotnet test --nologo --verbosity normal --filter "$(FILTER)" || true
	@cd $(ROOT)/tests/backend/Clarive.Api.IntegrationTests && dotnet test --nologo --verbosity normal --filter "$(FILTER)"

test-e2e-up: _require-docker ## Start E2E test stack (isolated, with seed data)
	@printf "$(C_CYAN)Starting E2E test stack...$(C_RESET)\n"
	@$(E2E_COMPOSE) up --build -d
	@printf "$(C_CYAN)Waiting for E2E stack to become healthy...$(C_RESET)\n"
	@ATTEMPTS=0; MAX_ATTEMPTS=30; \
	while [ $$ATTEMPTS -lt $$MAX_ATTEMPTS ]; do \
		HEALTH=$$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-check{{end}}' clarive-e2e-app 2>/dev/null || echo "not_found"); \
		case $$HEALTH in \
			healthy) \
				printf "\n$(C_BOLD)$(C_GREEN)E2E test stack ready.$(C_RESET)\n"; \
				printf "  App:    $(C_CYAN)http://localhost:8081$(C_RESET)\n"; \
				printf "  Run:    $(C_YELLOW)make test-e2e$(C_RESET)\n"; \
				printf "  Stop:   $(C_YELLOW)make test-e2e-down$(C_RESET)\n\n"; \
				exit 0;; \
			unhealthy) \
				printf "$(C_RED)  E2E app is unhealthy. Check: docker logs clarive-e2e-app$(C_RESET)\n"; \
				exit 1;; \
		esac; \
		ATTEMPTS=$$((ATTEMPTS + 1)); \
		printf "$(C_DIM)  Waiting... ($$ATTEMPTS/$$MAX_ATTEMPTS)$(C_RESET)\n"; \
		sleep 3; \
	done; \
	printf "$(C_RED)  Health check timed out.$(C_RESET)\n"; \
	exit 1

test-e2e: _require-sdk ## Run E2E tests against E2E stack
	@printf "$(C_CYAN)Running E2E tests...$(C_RESET)\n"
	@cd $(FE_DIR) && BASE_URL=http://localhost:8081 PLAYWRIGHT_DOCKER=1 npx playwright test

test-e2e-down: ## Tear down E2E test stack and destroy volumes
	@$(E2E_COMPOSE) down -v
	@printf "$(C_GREEN)E2E test stack removed.$(C_RESET)\n"

E2E_SNAPSHOT := $(DEPLOY)/e2e-snapshot.sql
E2E_AUTH_DIR := $(FE_DIR)/e2e/.auth

test-e2e-snapshot: _require-sdk ## Run foundation specs and save DB snapshot for fast restores
	@printf "$(C_CYAN)Running foundation specs (01-06 + 13) to build snapshot state...$(C_RESET)\n"
	@cd $(FE_DIR) && BASE_URL=http://localhost:8081 PLAYWRIGHT_DOCKER=1 \
		npx playwright test e2e/01-registration.spec.ts e2e/02-setup-wizard.spec.ts \
		e2e/03-onboarding.spec.ts e2e/04-onboarding-tour.spec.ts \
		e2e/05-entry-editing.spec.ts e2e/06-entry-versions.spec.ts \
		e2e/13-ai-model-config.spec.ts
	@printf "$(C_CYAN)Taking database snapshot...$(C_RESET)\n"
	@$(E2E_COMPOSE) exec -T postgres pg_dump -U clarive -d clarive --clean --if-exists > $(E2E_SNAPSHOT)
	@cp -r $(E2E_AUTH_DIR) $(DEPLOY)/e2e-auth-snapshot
	@printf "$(C_GREEN)Snapshot saved: $(E2E_SNAPSHOT) + auth state$(C_RESET)\n"
	@printf "$(C_DIM)  Restore with: make test-e2e-restore$(C_RESET)\n"
	@printf "$(C_DIM)  Run from spec: make test-e2e-from SPEC=06b$(C_RESET)\n"

test-e2e-restore: ## Restore DB from snapshot (use before test-e2e-from)
	@if [ ! -f "$(E2E_SNAPSHOT)" ]; then \
		printf "$(C_RED)No snapshot found. Run: make test-e2e-snapshot$(C_RESET)\n"; \
		exit 1; \
	fi
	@printf "$(C_CYAN)Restoring database from snapshot...$(C_RESET)\n"
	@$(E2E_COMPOSE) exec -T postgres psql -U clarive -d clarive < $(E2E_SNAPSHOT) > /dev/null 2>&1
	@cp -r $(DEPLOY)/e2e-auth-snapshot/* $(E2E_AUTH_DIR)/ 2>/dev/null || true
	@printf "$(C_GREEN)Snapshot restored. Ready to run specs.$(C_RESET)\n"

test-e2e-from: _require-sdk ## Run E2E tests starting from a spec. Usage: make test-e2e-from SPEC=06b
	@if [ -z "$(SPEC)" ]; then \
		printf "$(C_RED)Usage: make test-e2e-from SPEC=06b$(C_RESET)\n"; \
		exit 1; \
	fi
	@if [ ! -f "$(E2E_SNAPSHOT)" ]; then \
		printf "$(C_RED)No snapshot found. Run: make test-e2e-snapshot first$(C_RESET)\n"; \
		exit 1; \
	fi
	@printf "$(C_CYAN)Restoring snapshot and running from spec $(SPEC)...$(C_RESET)\n"
	@$(E2E_COMPOSE) exec -T postgres psql -U clarive -d clarive < $(E2E_SNAPSHOT) > /dev/null 2>&1
	@cp -r $(DEPLOY)/e2e-auth-snapshot/* $(E2E_AUTH_DIR)/ 2>/dev/null || true
	@cd $(FE_DIR) && BASE_URL=http://localhost:8081 PLAYWRIGHT_DOCKER=1 \
		npx playwright test $$(ls e2e/$(SPEC)*.spec.ts 2>/dev/null)

test-e2e-ui: _require-sdk ## Run E2E tests in interactive UI mode
	@printf "$(C_CYAN)Opening Playwright UI...$(C_RESET)\n"
	@cd $(FE_DIR) && BASE_URL=http://localhost:8081 PLAYWRIGHT_DOCKER=1 npx playwright test --ui

lint: _require-sdk ## Run frontend linter
	@printf "$(C_CYAN)Linting frontend...$(C_RESET)\n"
	@cd $(FE_DIR) && npm run lint

## —— Utilities ————————————————————————————————————————————

clean: ## Remove build artifacts and caches
	@printf "$(C_CYAN)Cleaning...$(C_RESET)\n"
	@rm -rf $(FE_DIR)/dist $(FE_DIR)/node_modules/.vite
	@cd $(BE_DIR) && dotnet clean --nologo -v q 2>/dev/null || true
	@printf "$(C_GREEN)Clean.$(C_RESET)\n"

## —— Internal Helpers ————————————————————————————————————

_health-check:
	@CONTAINER=$$(docker ps --format '{{.Names}}' --filter name=clarive-app | head -1); \
	if [ -z "$$CONTAINER" ]; then \
		printf "$(C_RED)Backend container not found.$(C_RESET)\n"; \
		exit 1; \
	fi; \
	printf "$(C_CYAN)Waiting for backend to become healthy...$(C_RESET)\n"; \
	ATTEMPTS=0; \
	MAX_ATTEMPTS=20; \
	while [ $$ATTEMPTS -lt $$MAX_ATTEMPTS ]; do \
		HEALTH=$$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-check{{end}}' $$CONTAINER 2>/dev/null || echo "not_found"); \
		case $$HEALTH in \
			healthy) \
				printf "$(C_GREEN)  Backend is healthy.$(C_RESET)\n"; \
				exit 0;; \
			unhealthy) \
				printf "$(C_RED)  Backend is unhealthy. Check logs with: docker logs $$CONTAINER$(C_RESET)\n"; \
				exit 1;; \
		esac; \
		ATTEMPTS=$$((ATTEMPTS + 1)); \
		printf "$(C_DIM)  Waiting... ($$ATTEMPTS/$$MAX_ATTEMPTS)$(C_RESET)\n"; \
		sleep 3; \
	done; \
	printf "$(C_RED)  Health check timed out after $$((MAX_ATTEMPTS * 3))s.$(C_RESET)\n"; \
	printf "  Check logs with: $(C_CYAN)docker logs $$CONTAINER$(C_RESET)\n"; \
	exit 1
