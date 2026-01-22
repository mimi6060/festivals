.PHONY: dev build test lint clean docker-build docker-up docker-down migrate swagger docs

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

# Swagger/OpenAPI Documentation
swagger:
	@echo "Installing swag if not present..."
	@which swag > /dev/null || go install github.com/swaggo/swag/cmd/swag@latest
	@echo "Generating Swagger documentation..."
	swag init -g ./cmd/api/main.go -o ./docs --parseDependency --parseInternal
	@echo "Swagger documentation generated in ./docs"

swagger-fmt:
	swag fmt

# Generate all documentation
docs: swagger
	@echo "Copying swagger.json to docs/api..."
	@mkdir -p ../docs/api
	@cp ./docs/swagger.json ../docs/api/swagger.json 2>/dev/null || true
	@echo "Documentation generated successfully!"
	@echo ""
	@echo "Access Swagger UI at: http://localhost:8080/swagger/index.html"
	@echo "OpenAPI spec: ../docs/api/openapi.yaml"
	@echo "Postman collection: ../docs/api/postman/Festivals.postman_collection.json"

# All
all: deps lint test build
