.PHONY: help setup install dev dev-all dev-frontend dev-backend \
       stop stop-all stop-frontend stop-backend restart restart-all \
       build build-frontend build-backend deploy \
       test test-frontend test-backend test-filter test-e2e test-e2e-ui lint clean \
       db-start db-stop db-restart db-status db-logs db-shell db-migrate db-migration-add db-reset \
       _health-check

SHELL   := /bin/bash
ROOT    := $(shell pwd)
FE_DIR  := $(ROOT)/src/frontend
BE_DIR  := $(ROOT)/src/backend/Clarive.Api
FE_PID  := $(ROOT)/.frontend.pid
BE_PID  := $(ROOT)/.backend.pid
FE_LOG  := $(ROOT)/.frontend.log
BE_LOG  := $(ROOT)/.backend.log

# Local dev compose (reuses deploy compose for the DB)
COMPOSE := docker compose -p clarive-local -f $(ROOT)/deploy/docker-compose.yml

# Deploy compose (ENV=dev or ENV=prod)
DEPLOY_DIR    := $(ROOT)/deploy
ENV           ?= dev
DEPLOY_COMPOSE = docker compose -p clarive-$(ENV) --env-file $(DEPLOY_DIR)/envs/$(ENV).env -f $(DEPLOY_DIR)/docker-compose.yml

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
	@printf "$(C_BOLD)SELF-HOST$(C_RESET)\n"
	@grep -E '^setup:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(C_GREEN)%-28s$(C_RESET) %s\n", $$1, $$2}'
	@echo ""
	@printf "$(C_BOLD)DEPLOYMENT$(C_RESET)\n"
	@grep -E '^deploy:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(C_GREEN)%-28s$(C_RESET) %s\n", $$1, $$2}'
	@echo ""
	@printf "$(C_BOLD)LOCAL DEVELOPMENT$(C_RESET)\n"
	@grep -E '^(install|dev|dev-all|dev-frontend|dev-backend|stop|stop-all|restart|restart-all|build|test|lint|clean):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(C_GREEN)%-28s$(C_RESET) %s\n", $$1, $$2}'
	@echo ""
	@printf "$(C_BOLD)DATABASE$(C_RESET)\n"
	@grep -E '^db-[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(C_GREEN)%-28s$(C_RESET) %s\n", $$1, $$2}'
	@echo ""

## —— Self-Host ————————————————————————————————————————————

setup: ## Generate .env with random secrets
	@scripts/setup.sh

## —— Deployment ———————————————————————————————————————————

deploy: ## Build images and deploy (ENV=dev|prod)
	@if [ ! -f "$(DEPLOY_DIR)/envs/$(ENV).env" ]; then \
		printf "$(C_RED)Missing: deploy/envs/$(ENV).env$(C_RESET)\n"; \
		printf "$(C_YELLOW)  cp deploy/.env.example deploy/envs/$(ENV).env && edit it$(C_RESET)\n"; \
		exit 1; \
	fi
	@TAG=$$(git rev-parse --short HEAD) && \
	printf "$(C_CYAN)Building images (tag: $$TAG)...$(C_RESET)\n" && \
	docker build --target production -t clarive-backend:$$TAG $(ROOT)/src/backend && \
	docker build --target production -t clarive-frontend:$$TAG $(ROOT)/src/frontend && \
	printf "$(C_GREEN)Images built.$(C_RESET)\n" && \
	\
	printf "$(C_CYAN)Deploying...$(C_RESET)\n" && \
	CLARIVE_TAG=$$TAG $(DEPLOY_COMPOSE) up -d && \
	\
	$(MAKE) --no-print-directory _health-check && \
	\
	printf "\n$(C_BOLD)$(C_GREEN)Deployed$(C_RESET) (tag: $$TAG)\n\n"

## —— Local Development ———————————————————————————————————

install: ## Install all dependencies
	@printf "$(C_CYAN)Installing frontend dependencies...$(C_RESET)\n"
	@cd $(FE_DIR) && npm install
	@printf "$(C_CYAN)Restoring backend packages...$(C_RESET)\n"
	@cd $(BE_DIR) && dotnet restore
	@printf "$(C_GREEN)All dependencies installed.$(C_RESET)\n"

dev: ## Start frontend + backend in background
	@$(MAKE) --no-print-directory dev-backend
	@$(MAKE) --no-print-directory dev-frontend
	@printf "\n$(C_BOLD)$(C_GREEN)Both services started.$(C_RESET)\n"
	@printf "  Frontend: $(C_CYAN)http://localhost:8080$(C_RESET)\n"
	@printf "  Backend:  $(C_CYAN)http://localhost:5000$(C_RESET)\n"
	@printf "  Logs:     $(C_YELLOW)tail -f .frontend.log .backend.log$(C_RESET)\n\n"

dev-all: ## Start database + frontend + backend
	@$(MAKE) --no-print-directory db-start
	@$(MAKE) --no-print-directory dev

dev-frontend: ## Start Vite dev server (port 8080)
	@if [ -f $(FE_PID) ] && kill -0 $$(cat $(FE_PID)) 2>/dev/null; then \
		printf "$(C_YELLOW)Frontend already running (PID %s)$(C_RESET)\n" "$$(cat $(FE_PID))"; \
	else \
		printf "$(C_CYAN)Starting frontend...$(C_RESET)\n"; \
		cd $(FE_DIR) && nohup npm run dev > $(FE_LOG) 2>&1 & echo $$! > $(FE_PID); \
		printf "$(C_GREEN)Frontend started$(C_RESET) (PID %s) → http://localhost:8080\n" "$$(cat $(FE_PID))"; \
	fi

dev-backend: ## Start .NET backend (port 5000)
	@if [ -f $(BE_PID) ] && kill -0 $$(cat $(BE_PID)) 2>/dev/null; then \
		printf "$(C_YELLOW)Backend already running (PID %s)$(C_RESET)\n" "$$(cat $(BE_PID))"; \
	else \
		printf "$(C_CYAN)Starting backend...$(C_RESET)\n"; \
		cd $(BE_DIR) && nohup dotnet run > $(BE_LOG) 2>&1 & echo $$! > $(BE_PID); \
		printf "$(C_GREEN)Backend started$(C_RESET) (PID %s) → http://localhost:5000\n" "$$(cat $(BE_PID))"; \
	fi

stop: ## Stop frontend + backend
	@$(MAKE) --no-print-directory stop-frontend
	@$(MAKE) --no-print-directory stop-backend

stop-all: ## Stop frontend + backend + database
	@$(MAKE) --no-print-directory stop
	@$(MAKE) --no-print-directory db-stop

stop-frontend: ## Stop frontend
	@if fuser 8080/tcp > /dev/null 2>&1; then \
		fuser -k 8080/tcp > /dev/null 2>&1; \
		rm -f $(FE_PID); \
		printf "$(C_GREEN)Frontend stopped.$(C_RESET)\n"; \
	else \
		rm -f $(FE_PID); \
		printf "$(C_YELLOW)Frontend not running.$(C_RESET)\n"; \
	fi

stop-backend: ## Stop backend
	@if fuser 5000/tcp > /dev/null 2>&1; then \
		fuser -k 5000/tcp > /dev/null 2>&1; \
		rm -f $(BE_PID); \
		printf "$(C_GREEN)Backend stopped.$(C_RESET)\n"; \
	else \
		rm -f $(BE_PID); \
		printf "$(C_YELLOW)Backend not running.$(C_RESET)\n"; \
	fi

restart: ## Restart frontend + backend
	@$(MAKE) --no-print-directory stop
	@sleep 1
	@$(MAKE) --no-print-directory dev

restart-all: ## Restart database + frontend + backend
	@$(MAKE) --no-print-directory stop-all
	@sleep 1
	@$(MAKE) --no-print-directory dev-all

## —— Database (Local Dev) ————————————————————————————————

db-start: ## Start local PostgreSQL container
	@if docker ps --format '{{.Names}}' | grep -q '^clarive-local-postgres'; then \
		printf "$(C_YELLOW)PostgreSQL already running.$(C_RESET)\n"; \
	else \
		printf "$(C_CYAN)Starting PostgreSQL...$(C_RESET)\n"; \
		$(COMPOSE) up -d postgres; \
		printf "$(C_GREEN)PostgreSQL started$(C_RESET) → localhost:5432 (db: clarive)\n"; \
	fi

db-stop: ## Stop local PostgreSQL container
	@if docker ps --format '{{.Names}}' | grep -q '^clarive-local-postgres'; then \
		$(COMPOSE) stop postgres; \
		printf "$(C_GREEN)PostgreSQL stopped.$(C_RESET)\n"; \
	else \
		printf "$(C_YELLOW)PostgreSQL not running.$(C_RESET)\n"; \
	fi

db-restart: ## Restart local PostgreSQL container
	@$(MAKE) --no-print-directory db-stop
	@$(MAKE) --no-print-directory db-start

db-status: ## Show local PostgreSQL status
	@if docker ps --format '{{.Names}}' | grep -q '^clarive-local-postgres'; then \
		printf "  PostgreSQL: $(C_GREEN)running$(C_RESET) (port 5432)\n"; \
		docker ps --format 'table {{.Status}}\t{{.Ports}}' --filter name=clarive-local-postgres; \
	else \
		printf "  PostgreSQL: $(C_RED)stopped$(C_RESET)\n"; \
	fi

db-logs: ## Tail local PostgreSQL logs
	@$(COMPOSE) logs -f postgres

db-shell: ## Open psql shell
	@docker exec -it $$(docker ps --format '{{.Names}}' --filter name=clarive.*postgres | head -1) \
		psql -U clarive -d clarive

db-migrate: ## Apply EF Core migrations (local dev)
	@printf "$(C_CYAN)Applying EF Core migrations...$(C_RESET)\n"
	@cd $(BE_DIR) && dotnet ef database update
	@printf "$(C_GREEN)Migrations applied.$(C_RESET)\n"

db-migration-add: ## Create a new migration. Usage: make db-migration-add NAME=MyMigration
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

db-reset: ## Destroy and recreate local PostgreSQL data
	@printf "$(C_RED)This will destroy all database data. Continue? [y/N] $(C_RESET)"; \
	read -r ans; \
	if [ "$$ans" = "y" ] || [ "$$ans" = "Y" ]; then \
		$(COMPOSE) down -v; \
		printf "$(C_GREEN)Database volume removed. Run 'make db-start' to recreate.$(C_RESET)\n"; \
	else \
		printf "$(C_YELLOW)Cancelled.$(C_RESET)\n"; \
	fi

## —— Build ————————————————————————————————————————————————

build: build-frontend build-backend ## Build both projects

build-frontend: ## Build frontend for production
	@printf "$(C_CYAN)Building frontend...$(C_RESET)\n"
	@cd $(FE_DIR) && npm run build
	@printf "$(C_GREEN)Frontend built → src/frontend/dist/$(C_RESET)\n"

build-backend: ## Build backend
	@printf "$(C_CYAN)Building backend...$(C_RESET)\n"
	@cd $(BE_DIR) && dotnet build --configuration Release --nologo -v q
	@printf "$(C_GREEN)Backend built.$(C_RESET)\n"

## —— Test / Lint ——————————————————————————————————————————

test: ## Run all tests
	@$(MAKE) --no-print-directory test-frontend
	@$(MAKE) --no-print-directory test-backend

test-frontend: ## Run frontend tests (vitest)
	@printf "$(C_CYAN)Running frontend tests...$(C_RESET)\n"
	@cd $(FE_DIR) && npx vitest run --passWithNoTests

test-backend: ## Run backend unit + integration tests
	@printf "$(C_CYAN)Running backend unit tests...$(C_RESET)\n"
	@cd $(ROOT)/tests/backend/Clarive.Api.UnitTests && dotnet test --nologo --verbosity normal
	@printf "$(C_CYAN)Running backend integration tests...$(C_RESET)\n"
	@cd $(ROOT)/tests/backend/Clarive.Api.IntegrationTests && dotnet test --nologo --verbosity normal

test-filter: ## Run filtered tests. Usage: make test-filter FILTER=Auth
	@if [ -z "$(FILTER)" ]; then \
		printf "$(C_RED)Usage: make test-filter FILTER=ClassName$(C_RESET)\n"; \
		exit 1; \
	fi
	@printf "$(C_CYAN)Running tests matching '$(FILTER)'...$(C_RESET)\n"
	@cd $(ROOT)/tests/backend/Clarive.Api.UnitTests && dotnet test --nologo --verbosity normal --filter "$(FILTER)" || true
	@cd $(ROOT)/tests/backend/Clarive.Api.IntegrationTests && dotnet test --nologo --verbosity normal --filter "$(FILTER)"

lint: ## Run frontend linter
	@printf "$(C_CYAN)Linting frontend...$(C_RESET)\n"
	@cd $(FE_DIR) && npm run lint

test-e2e: ## Run E2E tests (requires running backend + DB)
	@printf "$(C_CYAN)Running E2E tests...$(C_RESET)\n"
	@cd $(FE_DIR) && npx playwright test

test-e2e-ui: ## Run E2E tests in interactive UI mode
	@printf "$(C_CYAN)Opening Playwright UI...$(C_RESET)\n"
	@cd $(FE_DIR) && npx playwright test --ui

## —— Utilities ————————————————————————————————————————————

clean: ## Remove build artifacts and logs
	@printf "$(C_CYAN)Cleaning...$(C_RESET)\n"
	@rm -rf $(FE_DIR)/dist $(FE_DIR)/node_modules/.vite
	@cd $(BE_DIR) && dotnet clean --nologo -v q 2>/dev/null
	@rm -f $(FE_LOG) $(BE_LOG) $(FE_PID) $(BE_PID)
	@printf "$(C_GREEN)Clean.$(C_RESET)\n"

## —— Internal Helpers ————————————————————————————————————

_health-check:
	@CONTAINER=$$(docker ps --format '{{.Names}}' --filter name=clarive.*backend | head -1); \
	if [ -z "$$CONTAINER" ]; then \
		printf "$(C_RED)Backend container not found$(C_RESET)\n"; \
		exit 1; \
	fi; \
	printf "$(C_CYAN)Waiting for $$CONTAINER to become healthy...$(C_RESET)\n"; \
	ATTEMPTS=0; \
	MAX_ATTEMPTS=20; \
	while [ $$ATTEMPTS -lt $$MAX_ATTEMPTS ]; do \
		HEALTH=$$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-check{{end}}' $$CONTAINER 2>/dev/null || echo "not_found"); \
		case $$HEALTH in \
			healthy) \
				printf "$(C_GREEN)  ✓ $$CONTAINER is healthy$(C_RESET)\n"; \
				exit 0;; \
			unhealthy) \
				printf "$(C_RED)  ✗ $$CONTAINER is unhealthy$(C_RESET)\n"; \
				exit 1;; \
		esac; \
		ATTEMPTS=$$((ATTEMPTS + 1)); \
		printf "$(C_DIM)  Attempt $$ATTEMPTS/$$MAX_ATTEMPTS ($$HEALTH)...$(C_RESET)\n"; \
		sleep 3; \
	done; \
	printf "$(C_RED)  ✗ Health check timed out after $$((MAX_ATTEMPTS * 3))s$(C_RESET)\n"; \
	exit 1
