package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"hypetrain/internal/sim"
)

func TestHealth(t *testing.T) {
	rec := httptest.NewRecorder()
	New(Config{Brain: "stub"}).ServeHTTP(rec, httptest.NewRequest("GET", "/api/health", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["status"] != "ok" || body["brain"] != "stub" {
		t.Errorf("body = %v", body)
	}
}

func do(t *testing.T, h http.Handler, method, path, body string, want int, out any) {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
	if rec.Code != want {
		t.Fatalf("%s %s: status %d, want %d: %s", method, path, rec.Code, want, rec.Body)
	}
	if out != nil {
		if err := json.NewDecoder(rec.Body).Decode(out); err != nil {
			t.Fatal(err)
		}
	}
}

func TestRunLifecycle(t *testing.T) {
	dir := t.TempDir()
	h := New(Config{Brain: "stub", RunsDir: dir})

	var c Chunk
	do(t, h, "POST", "/api/runs", `{"seed": 4}`, http.StatusCreated, &c)
	if len(c.Blobs) != 100 || len(c.Options) == 0 || len(c.Rounds) != 0 || c.Done {
		t.Fatalf("start chunk: %d blobs, %d options, %d rounds", len(c.Blobs), len(c.Options), len(c.Rounds))
	}
	id := c.ID
	for k := range 5 {
		var next Chunk
		do(t, h, "POST", "/api/runs/"+id+"/story", `{"story": "bold"}`, http.StatusOK, &next)
		if len(next.Rounds) != 10 || next.Rounds[0].Index != k*10+1 || next.Blobs != nil {
			t.Fatalf("chunk %d: %d rounds", k, len(next.Rounds))
		}
		if next.Done != (k == 4) {
			t.Fatalf("chunk %d: done = %v", k, next.Done)
		}
	}
	do(t, h, "POST", "/api/runs/"+id+"/story", `{"story": "bold"}`, http.StatusConflict, nil)

	var log sim.RunLog
	do(t, h, "GET", "/api/runs/"+id, "", http.StatusOK, &log)
	if len(log.Rounds) != 50 {
		t.Fatalf("log has %d rounds", len(log.Rounds))
	}
	b, err := os.ReadFile(filepath.Join(dir, id+".json"))
	if err != nil {
		t.Fatal(err)
	}
	var saved sim.RunLog
	if err := json.Unmarshal(b, &saved); err != nil || !reflect.DeepEqual(saved, log) {
		t.Fatalf("saved log differs from served log (err %v)", err)
	}
}

func TestRunErrors(t *testing.T) {
	h := New(Config{MaxBlobs: 50})
	do(t, h, "POST", "/api/runs", `{"blobs": 51}`, http.StatusBadRequest, nil)
	do(t, h, "POST", "/api/runs", `{`, http.StatusBadRequest, nil)
	do(t, h, "POST", "/api/runs/nope/story", `{"story": "bold"}`, http.StatusNotFound, nil)
	do(t, h, "GET", "/api/runs/nope", "", http.StatusNotFound, nil)

	var c Chunk
	do(t, h, "POST", "/api/runs", `{"blobs": 20}`, http.StatusCreated, &c)
	do(t, h, "POST", "/api/runs/"+c.ID+"/story", `{"story": "lies"}`, http.StatusConflict, nil)
}
