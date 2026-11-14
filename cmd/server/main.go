// Command server runs the Hype Train API and, if built, serves the client.
package main

import (
	"cmp"
	"log"
	"net/http"
	"os"

	"hypetrain/internal/server"
)

func main() {
	cfg := server.Config{
		Brain: cmp.Or(os.Getenv("BRAIN"), "stub"),
	}
	if _, err := os.Stat("web/dist"); err == nil {
		cfg.WebDist = "web/dist"
	}
	addr := cmp.Or(os.Getenv("ADDR"), "localhost:8080")

	log.Printf("listening on http://%s (brain=%s)", addr, cfg.Brain)
	log.Fatal(http.ListenAndServe(addr, server.New(cfg)))
}
