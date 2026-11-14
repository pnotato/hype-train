# Load .env (server-side settings) if present and export to child processes.
-include .env
export

.PHONY: dev server web build test check fmt

# Go server + Vite dev server together (Ctrl-C stops both).
dev:
	$(MAKE) -j2 server web

server:
	go run ./cmd/server

web:
	npm --prefix web run dev

build:
	npm --prefix web run build
	go build -o bin/server ./cmd/server

test:
	go test ./...

# Must pass before a change is called done.
check:
	@test -z "$$(gofmt -l .)" || { gofmt -l .; echo "run: make fmt"; exit 1; }
	go vet ./...
	go test ./...
	npm --prefix web run typecheck
	npm --prefix web run lint
	npm --prefix web run format:check

fmt:
	gofmt -w .
	npm --prefix web run format
