.PHONY: help setup dev stop restart logs deploy undeploy \
       build build-frontend build-backend \
       test test-frontend test-backend test-filter test-e2e test-e2e-ui lint clean \
       db-shell db-migrate db-migration-add db-reset \
       _health-check

SHELL   := /bin/bash
ROOT    := $(shell pwd)
FE_DIR  := $(ROOT)/src/frontend
BE_DIR  := $(ROOT)/src/backend/Clarive.Api
DEPLOY  := $(ROOT)/deploy

# Dev compose (all Docker, hot reload via volume mounts)
DEV_COMPOSE = docker compose -p clarive-dev -f $(DEPLOY)/docker-compose.yml -f $(DEPLOY)/docker-compose.dev.yml

# Production compose
PROD_COMPOSE = docker compose -p clarive --env-file $(DEPLOY)/.env -f $(DEPLOY)/docker-compose.yml

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
	@printf "$(C_BOLD)DEVELOPMENT$(C_RESET)\n"
	@grep -E '^(dev|stop|restart|logs):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(C_GREEN)%-28s$(C_RESET) %s\n", $$1, $$2}'
	@echo ""
	@printf "$(C_BOLD)DEPLOYMENT$(C_RESET)\n"
	@grep -E '^(setup|deploy|undeploy):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(C_GREEN)%-28s$(C_RESET) %s\n", $$1, $$2}'
	@echo ""
	@printf "$(C_BOLD)DATABASE$(C_RESET)\n"
	@grep -E '^db-[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(C_GREEN)%-28s$(C_RESET) %s\n", $$1, $$2}'
	@echo ""
	@printf "$(C_BOLD)BUILD / TEST$(C_RESET)\n"
	@grep -E '^(build|test|lint|clean):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(C_GREEN)%-28s$(C_RESET) %s\n", $$1, $$2}'
	@echo ""

## —— Development (all Docker, hot reload) ————————————————

dev: ## Start all services with hot reload
	@printf "$(C_CYAN)Starting development environment...$(C_RESET)\n"
	@$(DEV_COMPOSE) up --build -d
	@printf "\n$(C_BOLD)$(C_GREEN)Development environment started.$(C_RESET)\n"
	@printf "  Frontend: $(C_CYAN)http://localhost:8080$(C_RESET)  (Vite HMR)\n"
	@printf "  Backend:  $(C_CYAN)http://localhost:5000$(C_RESET)  (dotnet watch)\n"
	@printf "  Logs:     $(C_YELLOW)make logs$(C_RESET)\n\n"

stop: ## Stop all development services
	@$(DEV_COMPOSE) down
	@printf "$(C_GREEN)Development environment stopped.$(C_RESET)\n"

restart: ## Restart all development services
	@$(DEV_COMPOSE) down
	@$(DEV_COMPOSE) up --build -d
	@printf "$(C_GREEN)Development environment restarted.$(C_RESET)\n"

logs: ## Tail development service logs
	@$(DEV_COMPOSE) logs -f

## —— Deployment (production) —————————————————————————————

setup: ## Generate deploy/.env with random secrets
	@scripts/setup.sh

deploy: ## Build images and deploy production stack
	@if [ ! -f "$(DEPLOY)/.env" ]; then \
		printf "$(C_RED)Missing: deploy/.env$(C_RESET)\n"; \
		printf "$(C_YELLOW)  cp deploy/.env.example deploy/.env && edit it$(C_RESET)\n"; \
		printf "$(C_YELLOW)  or run: make setup$(C_RESET)\n"; \
		exit 1; \
	fi
	@TAG=$$(git rev-parse --short HEAD) && \
	printf "$(C_CYAN)Building images (tag: $$TAG)...$(C_RESET)\n" && \
	docker build --target production -t clarive-backend:$$TAG $(ROOT)/src/backend && \
	docker build --target production -t clarive-frontend:$$TAG $(ROOT)/src/frontend && \
	printf "$(C_GREEN)Images built.$(C_RESET)\n" && \
	\
	printf "$(C_CYAN)Deploying...$(C_RESET)\n" && \
	CLARIVE_TAG=$$TAG $(PROD_COMPOSE) up -d && \
	\
	$(MAKE) --no-print-directory _health-check && \
	\
	printf "\n$(C_BOLD)$(C_GREEN)Deployed$(C_RESET) (tag: $$TAG)\n\n"

undeploy: ## Stop and remove production stack
	@$(PROD_COMPOSE) down
	@printf "$(C_GREEN)Production stack stopped.$(C_RESET)\n"

## —— Database ———————————————————————————————————————————

db-shell: ## Open psql shell
	@docker exec -it $$(docker ps --format '{{.Names}}' --filter name=clarive.*postgres | head -1) \
		psql -U clarive -d clarive

db-migrate: ## Apply EF Core migrations (requires dotnet SDK)
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

db-reset: ## Destroy and recreate database volume
	@printf "$(C_RED)This will destroy all database data. Continue? [y/N] $(C_RESET)"; \
	read -r ans; \
	if [ "$$ans" = "y" ] || [ "$$ans" = "Y" ]; then \
		$(DEV_COMPOSE) down -v 2>/dev/null; \
		$(PROD_COMPOSE) down -v 2>/dev/null; \
		printf "$(C_GREEN)Database volume removed. Run 'make dev' or 'make deploy' to recreate.$(C_RESET)\n"; \
	else \
		printf "$(C_YELLOW)Cancelled.$(C_RESET)\n"; \
	fi

## —— Build / Test ————————————————————————————————————————

build: build-frontend build-backend ## Build both projects

build-frontend: ## Build frontend for production
	@printf "$(C_CYAN)Building frontend...$(C_RESET)\n"
	@cd $(FE_DIR) && npm run build
	@printf "$(C_GREEN)Frontend built.$(C_RESET)\n"

build-backend: ## Build backend
	@printf "$(C_CYAN)Building backend...$(C_RESET)\n"
	@cd $(BE_DIR) && dotnet build --configuration Release --nologo -v q
	@printf "$(C_GREEN)Backend built.$(C_RESET)\n"

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

test-e2e: ## Run E2E tests (requires running dev environment)
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
	@rm -f $(ROOT)/.frontend.log $(ROOT)/.backend.log $(ROOT)/.frontend.pid $(ROOT)/.backend.pid
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
