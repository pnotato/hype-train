// Package server wires HTTP routes to the simulation and model providers.
package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"

	"hypetrain/internal/sim"
)

// Config holds server settings, read once from the environment in main.
type Config struct {
	Brain    string // "stub" or "anthropic"
	WebDist  string // built client to serve; empty in dev (Vite serves it)
	RunsDir  string // where each run's RunLog is written; empty = don't write
	MaxBlobs int    // hard cap on blobs per run (hard rule 7)
}

// run is one game in progress. The sim isn't safe for concurrent use, so each
// run has its own lock.
type run struct {
	mu   sync.Mutex
	game *sim.Game
}

type server struct {
	cfg  Config
	mu   sync.Mutex
	runs map[string]*run
	next atomic.Int64
}

// Chunk is what the client gets after each choice: the rounds just played and
// the next options. Blobs are sent only when a run starts.
type Chunk struct {
	ID      string      `json:"id"`
	Config  sim.Config  `json:"config"`
	Blobs   []sim.Blob  `json:"blobs,omitempty"`
	Rounds  []sim.Round `json:"rounds"`
	Options []sim.Story `json:"options"`
	Done    bool        `json:"done"`
}

// New returns the app's HTTP handler.
func New(cfg Config) http.Handler {
	if cfg.MaxBlobs == 0 {
		cfg.MaxBlobs = 200
	}
	s := &server{cfg: cfg, runs: map[string]*run{}}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "brain": cfg.Brain})
	})
	mux.HandleFunc("POST /api/runs", s.createRun)
	mux.HandleFunc("POST /api/runs/{id}/story", s.chooseStory)
	mux.HandleFunc("GET /api/runs/{id}", s.getRun)
	if cfg.WebDist != "" {
		mux.Handle("/", http.FileServer(http.Dir(cfg.WebDist)))
	}
	return mux
}

// createRun starts a run. Body (all optional): {"seed": 42, "blobs": 100}.
func (s *server) createRun(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Seed  *uint64 `json:"seed"`
		Blobs int     `json:"blobs"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "bad JSON: "+err.Error())
		return
	}
	seed := rand.Uint64()
	if req.Seed != nil {
		seed = *req.Seed
	}
	cfg := sim.DefaultConfig(seed)
	if req.Blobs != 0 {
		cfg.Blobs = req.Blobs
	}
	if cfg.Blobs > s.cfg.MaxBlobs {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("blobs %d over the cap of %d", cfg.Blobs, s.cfg.MaxBlobs))
		return
	}
	g, err := sim.NewGame(cfg)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	id := fmt.Sprintf("run-%d-%x", s.next.Add(1), seed)
	s.mu.Lock()
	s.runs[id] = &run{game: g}
	s.mu.Unlock()

	s.save(id, g)
	slog.Info("run started", "run", id, "seed", seed, "blobs", cfg.Blobs)
	writeJSON(w, http.StatusCreated, Chunk{
		ID: id, Config: cfg, Blobs: g.Log().Blobs, Rounds: []sim.Round{}, Options: g.Options(),
	})
}

// chooseStory publishes the player's story and plays up to the next choice.
// Body: {"story": "bold"}.
func (s *server) chooseStory(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	rn := s.run(id)
	if rn == nil {
		writeError(w, http.StatusNotFound, "no run "+id)
		return
	}
	var req struct {
		Story string `json:"story"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad JSON: "+err.Error())
		return
	}

	rn.mu.Lock()
	defer rn.mu.Unlock()
	rounds, err := rn.game.Choose(req.Story)
	if err != nil {
		writeError(w, http.StatusConflict, err.Error())
		return
	}
	s.save(id, rn.game)
	last := rounds[len(rounds)-1]
	slog.Info("rounds played", "run", id, "story", req.Story, "through", last.Index,
		"perception", last.AvgPerception, "interest", last.AvgInterest)
	writeJSON(w, http.StatusOK, Chunk{
		ID: id, Config: rn.game.Log().Config, Rounds: rounds,
		Options: rn.game.Options(), Done: rn.game.Done(),
	})
}

// getRun returns the whole RunLog so far.
func (s *server) getRun(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	rn := s.run(id)
	if rn == nil {
		writeError(w, http.StatusNotFound, "no run "+id)
		return
	}
	rn.mu.Lock()
	defer rn.mu.Unlock()
	writeJSON(w, http.StatusOK, rn.game.Log())
}

func (s *server) run(id string) *run {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.runs[id]
}

// save writes the RunLog to RunsDir so every run is kept on disk. A failed
// write is logged, not fatal: the run itself is still in memory.
func (s *server) save(id string, g *sim.Game) {
	if s.cfg.RunsDir == "" {
		return
	}
	b, err := json.Marshal(g.Log())
	if err == nil {
		err = os.MkdirAll(s.cfg.RunsDir, 0o755)
	}
	if err == nil {
		err = os.WriteFile(filepath.Join(s.cfg.RunsDir, id+".json"), b, 0o644)
	}
	if err != nil {
		slog.Error("save run", "run", id, "err", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
