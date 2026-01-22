# Festivals Platform Makefile
# Common commands for development, testing, and deployment

.PHONY: help dev dev-api dev-admin dev-mobile build build-api build-admin \
        test test-api test-admin test-mobile lint lint-api lint-admin lint-mobile \
        migrate migrate-up migrate-down migrate-create docker-build docker-up docker-down \
        docker-logs clean install deps prod-up prod-down

# Default target
.DEFAULT_GOAL := help

# Colors for output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RESET := \033[0m

# ============================================
# Help
# ============================================
help: ## Show this help message
	@echo "$(CYAN)Festivals Platform$(RESET) - Available Commands:"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ============================================
# Development
# ============================================
dev: ## Start all services in development mode
	docker-compose up -d postgres redis minio
	@echo "$(YELLOW)Waiting for services to be ready...$(RESET)"
	@sleep 3
	@$(MAKE) -j3 dev-api dev-admin dev-mobile

dev-api: ## Start backend API in development mode
	cd backend && air -c .air.toml 2>/dev/null || go run ./cmd/api

dev-admin: ## Start admin dashboard in development mode
	cd admin && pnpm dev

dev-mobile: ## Start mobile app in development mode
	cd mobile && npm start

dev-docker: ## Start all services with Docker (hot reload)
	docker-compose up --build

dev-docker-detached: ## Start all services with Docker in background
	docker-compose up -d --build

# ============================================
# Build
# ============================================
build: build-api build-admin ## Build all applications

build-api: ## Build backend API
	cd backend && go build -o bin/api ./cmd/api

build-admin: ## Build admin dashboard
	cd admin && pnpm build

build-mobile-web: ## Build mobile app for web
	cd mobile && npx expo export --platform web

build-docker: ## Build all Docker images
	docker-compose build

build-docker-prod: ## Build production Docker images
	docker-compose -f docker-compose.prod.yml build

# ============================================
# Testing
# ============================================
test: test-api test-admin test-mobile ## Run all tests

test-api: ## Run backend tests
	cd backend && go test -v -race ./...

test-api-coverage: ## Run backend tests with coverage
	cd backend && go test -v -race -coverprofile=coverage.out ./...
	cd backend && go tool cover -html=coverage.out -o coverage.html
	@echo "$(GREEN)Coverage report generated at backend/coverage.html$(RESET)"

test-admin: ## Run admin dashboard tests
	cd admin && pnpm test --run

test-admin-coverage: ## Run admin tests with coverage
	cd admin && pnpm test:coverage

test-mobile: ## Run mobile app tests
	cd mobile && npm test -- --passWithNoTests

test-e2e: ## Run end-to-end tests
	@echo "$(YELLOW)E2E tests not yet implemented$(RESET)"

# ============================================
# Linting
# ============================================
lint: lint-api lint-admin lint-mobile ## Run all linters

lint-api: ## Lint backend code
	cd backend && golangci-lint run

lint-admin: ## Lint admin dashboard code
	cd admin && pnpm lint

lint-mobile: ## Lint mobile app code
	cd mobile && npm run lint

lint-fix: ## Fix linting issues where possible
	cd backend && golangci-lint run --fix
	cd admin && pnpm lint --fix
	cd mobile && npm run lint -- --fix

# ============================================
# Database Migrations
# ============================================
migrate: migrate-up ## Alias for migrate-up

migrate-up: ## Run database migrations
	cd backend && migrate -path ./internal/infrastructure/database/migrations \
		-database "$${DATABASE_URL:-postgres://festivals:password@localhost:5432/festivals?sslmode=disable}" up

migrate-down: ## Rollback last migration
	cd backend && migrate -path ./internal/infrastructure/database/migrations \
		-database "$${DATABASE_URL:-postgres://festivals:password@localhost:5432/festivals?sslmode=disable}" down 1

migrate-down-all: ## Rollback all migrations
	cd backend && migrate -path ./internal/infrastructure/database/migrations \
		-database "$${DATABASE_URL:-postgres://festivals:password@localhost:5432/festivals?sslmode=disable}" down

migrate-create: ## Create a new migration (usage: make migrate-create NAME=migration_name)
	@if [ -z "$(NAME)" ]; then \
		echo "$(YELLOW)Usage: make migrate-create NAME=migration_name$(RESET)"; \
		exit 1; \
	fi
	cd backend && migrate create -ext sql -dir ./internal/infrastructure/database/migrations -seq $(NAME)

migrate-status: ## Show migration status
	cd backend && migrate -path ./internal/infrastructure/database/migrations \
		-database "$${DATABASE_URL:-postgres://festivals:password@localhost:5432/festivals?sslmode=disable}" version

# ============================================
# Docker Commands
# ============================================
docker-up: ## Start Docker services
	docker-compose up -d

docker-down: ## Stop Docker services
	docker-compose down

docker-down-volumes: ## Stop Docker services and remove volumes
	docker-compose down -v

docker-logs: ## View logs from all services
	docker-compose logs -f

docker-logs-api: ## View API logs
	docker-compose logs -f api

docker-logs-admin: ## View admin logs
	docker-compose logs -f admin

docker-ps: ## Show running containers
	docker-compose ps

docker-restart: ## Restart all services
	docker-compose restart

docker-clean: ## Remove all containers, images, and volumes
	docker-compose down -v --rmi all --remove-orphans

# ============================================
# Production Commands
# ============================================
prod-up: ## Start production environment
	docker-compose -f docker-compose.prod.yml up -d

prod-down: ## Stop production environment
	docker-compose -f docker-compose.prod.yml down

prod-logs: ## View production logs
	docker-compose -f docker-compose.prod.yml logs -f

prod-deploy: ## Deploy to production (placeholder)
	@echo "$(YELLOW)Production deployment should be done via CI/CD$(RESET)"
	@echo "Run: gh workflow run deploy.yml -f environment=production"

# ============================================
# Dependencies
# ============================================
deps: ## Install all dependencies
	@$(MAKE) deps-api deps-admin deps-mobile

deps-api: ## Install backend dependencies
	cd backend && go mod download && go mod tidy

deps-admin: ## Install admin dependencies
	cd admin && pnpm install

deps-mobile: ## Install mobile dependencies
	cd mobile && npm install

install: deps ## Alias for deps

# ============================================
# Code Generation
# ============================================
generate: ## Run code generation
	cd backend && go generate ./...

generate-api-docs: ## Generate API documentation
	cd backend && swag init -g ./cmd/api/main.go -o ./docs

# ============================================
# Utilities
# ============================================
clean: ## Clean build artifacts
	cd backend && rm -rf bin/ tmp/ coverage.out coverage.html
	cd admin && rm -rf .next/ out/ node_modules/.cache
	cd mobile && rm -rf dist/ node_modules/.cache
	@echo "$(GREEN)Cleaned build artifacts$(RESET)"

format: ## Format all code
	cd backend && gofmt -w .
	cd admin && pnpm prettier --write .
	cd mobile && npx prettier --write .

check-tools: ## Check if required tools are installed
	@echo "Checking required tools..."
	@command -v go >/dev/null 2>&1 || echo "$(YELLOW)go is not installed$(RESET)"
	@command -v node >/dev/null 2>&1 || echo "$(YELLOW)node is not installed$(RESET)"
	@command -v pnpm >/dev/null 2>&1 || echo "$(YELLOW)pnpm is not installed$(RESET)"
	@command -v docker >/dev/null 2>&1 || echo "$(YELLOW)docker is not installed$(RESET)"
	@command -v docker-compose >/dev/null 2>&1 || echo "$(YELLOW)docker-compose is not installed$(RESET)"
	@command -v golangci-lint >/dev/null 2>&1 || echo "$(YELLOW)golangci-lint is not installed$(RESET)"
	@command -v migrate >/dev/null 2>&1 || echo "$(YELLOW)migrate is not installed$(RESET)"
	@echo "$(GREEN)Tool check complete$(RESET)"

setup: check-tools deps ## Initial project setup
	@echo "$(GREEN)Project setup complete!$(RESET)"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Copy .env.example to .env and configure"
	@echo "  2. Run 'make docker-up' to start services"
	@echo "  3. Run 'make migrate' to run migrations"
	@echo "  4. Run 'make dev' to start development"

# ============================================
# CI Commands
# ============================================
ci: lint test build ## Run CI pipeline locally
	@echo "$(GREEN)CI pipeline completed successfully$(RESET)"

ci-api: lint-api test-api build-api ## Run CI for API only

ci-admin: lint-admin test-admin build-admin ## Run CI for admin only
