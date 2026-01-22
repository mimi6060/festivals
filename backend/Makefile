.PHONY: dev build test lint clean docker-build docker-up docker-down migrate

# Development
dev:
	go run ./cmd/api

# Build
build:
	go build -o bin/api ./cmd/api

# Test
test:
	go test -v ./...

test-coverage:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Lint
lint:
	golangci-lint run

# Clean
clean:
	rm -rf bin/
	rm -f coverage.out coverage.html

# Docker
docker-build:
	docker build -t festivals-api .

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f api

# Database migrations
migrate-up:
	migrate -path ./internal/infrastructure/database/migrations -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path ./internal/infrastructure/database/migrations -database "$(DATABASE_URL)" down

migrate-create:
	@read -p "Enter migration name: " name; \
	migrate create -ext sql -dir ./internal/infrastructure/database/migrations -seq $$name

# Dependencies
deps:
	go mod download
	go mod tidy

# Generate
generate:
	go generate ./...

# All
all: deps lint test build
