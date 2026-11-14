// Package server wires HTTP routes to the simulation and model providers.
package server

import (
	"encoding/json"
	"net/http"
)

// Config holds server settings, read once from the environment in main.
type Config struct {
	Brain   string // "stub" or "anthropic"
	WebDist string // built client to serve; empty in dev (Vite serves it)
}

// New returns the app's HTTP handler.
func New(cfg Config) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "brain": cfg.Brain})
	})
	if cfg.WebDist != "" {
		mux.Handle("/", http.FileServer(http.Dir(cfg.WebDist)))
	}
	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
