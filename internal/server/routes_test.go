package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"

	"hypetrain/internal/sim"
)

func TestCreateRunDefaults(t *testing.T) {
	h := New(Config{})
	var a, b Chunk
	do(t, h, "POST", "/api/runs", "", http.StatusCreated, &a) // empty body is allowed
	do(t, h, "POST", "/api/runs", "{}", http.StatusCreated, &b)
	if a.ID == b.ID {
		t.Errorf("two runs share id %s", a.ID)
	}
	if a.Config.Blobs != 100 || a.Config.Rounds != 50 || a.Config.StoryEvery != 10 {
		t.Errorf("default config %+v", a.Config)
	}
}

func TestCreateRunSameSeed(t *testing.T) {
	h := New(Config{})
	var a, b Chunk
	do(t, h, "POST", "/api/runs", `{"seed": 0}`, http.StatusCreated, &a) // seed 0 is a real seed, not "unset"
	do(t, h, "POST", "/api/runs", `{"seed": 0}`, http.StatusCreated, &b)
	if a.Config.Seed != 0 || !reflect.DeepEqual(a.Blobs, b.Blobs) {
		t.Fatal("same seed gave different towns")
	}
	var ra, rb Chunk
	do(t, h, "POST", "/api/runs/"+a.ID+"/story", `{"story": "honest"}`, http.StatusOK, &ra)
	do(t, h, "POST", "/api/runs/"+b.ID+"/story", `{"story": "honest"}`, http.StatusOK, &rb)
	if !reflect.DeepEqual(ra.Rounds, rb.Rounds) {
		t.Fatal("same seed and story gave different rounds")
	}
}

func TestBlobCap(t *testing.T) {
	h := New(Config{}) // default cap is 200
	do(t, h, "POST", "/api/runs", `{"blobs": 200}`, http.StatusCreated, nil)
	do(t, h, "POST", "/api/runs", `{"blobs": 201}`, http.StatusBadRequest, nil)
	do(t, h, "POST", "/api/runs", `{"blobs": 1}`, http.StatusBadRequest, nil)
}

func TestBadStoryBody(t *testing.T) {
	h := New(Config{})
	var c Chunk
	do(t, h, "POST", "/api/runs", `{"blobs": 20}`, http.StatusCreated, &c)
	do(t, h, "POST", "/api/runs/"+c.ID+"/story", `{`, http.StatusBadRequest, nil)
	do(t, h, "POST", "/api/runs/"+c.ID+"/story", ``, http.StatusBadRequest, nil)
	do(t, h, "POST", "/api/runs/"+c.ID+"/story", `{}`, http.StatusConflict, nil) // no story picked

	var log sim.RunLog
	do(t, h, "GET", "/api/runs/"+c.ID, "", http.StatusOK, &log)
	if len(log.Rounds) != 0 {
		t.Errorf("bad requests played %d rounds", len(log.Rounds))
	}
}

func TestWrongMethods(t *testing.T) {
	h := New(Config{})
	for _, r := range [][2]string{{"GET", "/api/runs"}, {"POST", "/api/health"}, {"GET", "/api/runs/x/story"}} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(r[0], r[1], nil))
		if rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("%s %s: status %d, want 405", r[0], r[1], rec.Code)
		}
	}
}

func TestJSONContentType(t *testing.T) {
	h := New(Config{})
	for _, r := range [][2]string{{"GET", "/api/health"}, {"POST", "/api/runs"}, {"GET", "/api/runs/nope"}} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(r[0], r[1], nil))
		if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
			t.Errorf("%s %s: Content-Type %q", r[0], r[1], ct)
		}
	}
}

// A run that can't be saved still plays; saving is best effort.
func TestSaveFailureNotFatal(t *testing.T) {
	file := filepath.Join(t.TempDir(), "not-a-dir")
	if err := os.WriteFile(file, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	h := New(Config{RunsDir: file})
	var c Chunk
	do(t, h, "POST", "/api/runs", `{"blobs": 20}`, http.StatusCreated, &c)
	do(t, h, "POST", "/api/runs/"+c.ID+"/story", `{"story": "bold"}`, http.StatusOK, nil)
}

func TestNoRunsDirWritesNothing(t *testing.T) {
	t.Chdir(t.TempDir())
	h := New(Config{})
	do(t, h, "POST", "/api/runs", `{"blobs": 20}`, http.StatusCreated, nil)
	if entries, _ := os.ReadDir("."); len(entries) != 0 {
		t.Errorf("wrote %d files with no RunsDir", len(entries))
	}
}

// Story choices racing on one run are applied one at a time. Run with -race.
func TestConcurrentStories(t *testing.T) {
	h := New(Config{})
	var c Chunk
	do(t, h, "POST", "/api/runs", `{"blobs": 30, "seed": 1}`, http.StatusCreated, &c)

	const tries = 8 // more than the run's 5 choices
	codes := make([]int, tries)
	var wg sync.WaitGroup
	for k := range tries {
		wg.Go(func() {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/runs/"+c.ID+"/story", strings.NewReader(`{"story": "bold"}`)))
			codes[k] = rec.Code
		})
		wg.Go(func() {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/runs/"+c.ID, nil))
		})
	}
	wg.Wait()

	ok := 0
	for _, code := range codes {
		if code == http.StatusOK {
			ok++
		} else if code != http.StatusConflict {
			t.Errorf("unexpected status %d", code)
		}
	}
	if ok != 5 {
		t.Errorf("%d choices accepted, want 5", ok)
	}
	var log sim.RunLog
	do(t, h, "GET", "/api/runs/"+c.ID, "", http.StatusOK, &log)
	for k, r := range log.Rounds {
		if r.Index != k+1 {
			t.Fatalf("round %d has index %d", k+1, r.Index)
		}
	}
	if len(log.Rounds) != 50 {
		t.Errorf("log has %d rounds, want 50", len(log.Rounds))
	}
}

func TestServesWebDist(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<p>town</p>"), 0o644); err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	New(Config{WebDist: dir}).ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "town") {
		t.Errorf("GET /: %d %q", rec.Code, rec.Body)
	}

	rec = httptest.NewRecorder()
	New(Config{}).ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("without WebDist, GET / = %d, want 404", rec.Code)
	}
}
