package sim

import (
	"math"
	"slices"
	"testing"
)

// Edge cases of the game API and the round loop that game_test.go doesn't cover.

func TestNewGameErrors(t *testing.T) {
	for _, cfg := range []Config{
		{Blobs: 100, Rounds: 0, StoryEvery: 10},
		{Blobs: 100, Rounds: 10, StoryEvery: 0},
		{Blobs: 100, Rounds: -1, StoryEvery: 10},
		{Blobs: 1, Rounds: 10, StoryEvery: 10},
	} {
		if _, err := NewGame(cfg); err == nil {
			t.Errorf("NewGame(%+v) should fail", cfg)
		}
	}
}

func TestReplayErrors(t *testing.T) {
	if _, err := Replay(DefaultConfig(1), []string{"bold", "nope"}); err == nil {
		t.Error("replay with an unknown story should fail")
	}
	if _, err := Replay(DefaultConfig(1), slices.Repeat([]string{"bold"}, 6)); err == nil {
		t.Error("replay past the last round should fail")
	}
	if _, err := Replay(Config{}, nil); err == nil {
		t.Error("replay with a bad config should fail")
	}
}

func TestUnknownStoryLeavesLogAlone(t *testing.T) {
	g, _ := NewGame(DefaultConfig(1))
	if _, err := g.Choose("nope"); err == nil {
		t.Fatal("unknown story accepted")
	}
	if l := g.Log(); len(l.Rounds)+len(l.Stories)+len(l.Choices) != 0 {
		t.Errorf("failed choice changed the log: %d rounds, %d stories, %d choices", len(l.Rounds), len(l.Stories), len(l.Choices))
	}
}

func TestOptionsAreCopies(t *testing.T) {
	g, _ := NewGame(DefaultConfig(1))
	opts := g.Options()
	if len(opts) == 0 {
		t.Fatal("no options at the start")
	}
	id := opts[0].ID
	opts[0].ID = "changed"
	if g.Options()[0].ID != id {
		t.Error("changing the returned options changed the game")
	}
	for _, o := range opts[1:] {
		if _, err := g.Choose(o.ID); err != nil {
			t.Errorf("option %q not choosable: %v", o.ID, err)
		}
	}
}

// Rounds that don't divide evenly by StoryEvery end with a short last chunk.
func TestUnevenChunks(t *testing.T) {
	g, err := NewGame(Config{Blobs: 30, Rounds: 7, StoryEvery: 3, Seed: 1})
	if err != nil {
		t.Fatal(err)
	}
	var sizes []int
	for !g.Done() {
		rounds, err := g.Choose("modest")
		if err != nil {
			t.Fatal(err)
		}
		sizes = append(sizes, len(rounds))
	}
	if !slices.Equal(sizes, []int{3, 3, 1}) {
		t.Errorf("chunk sizes %v, want [3 3 1]", sizes)
	}
	var at []int
	for _, c := range g.Log().Choices {
		at = append(at, c.Round)
	}
	if !slices.Equal(at, []int{1, 4, 7}) {
		t.Errorf("choices at rounds %v, want [1 4 7]", at)
	}
	if len(g.Log().Stories) != 3 {
		t.Errorf("%d stories published, want 3", len(g.Log().Stories))
	}
}

func TestLeadersAlwaysSeeStory(t *testing.T) {
	g := play(t, 4, "bold")
	blobs := g.Log().Blobs
	for _, r := range g.Log().Rounds {
		for _, e := range r.Events {
			if e.Kind != KindStory {
				continue
			}
			if e.Story != "bold" {
				t.Errorf("%s: story %q, want bold", e.ID, e.Story)
			}
			for k, b := range blobs {
				if b.Has(Leader) && !slices.Contains(e.To, k) {
					t.Errorf("%s: leader %d missed the story", e.ID, k)
				}
			}
		}
	}
}

func TestRoundAverages(t *testing.T) {
	for _, r := range play(t, 6, "modest").Log().Rounds {
		pSum, iSum := 0, 0
		for k := range r.Perception {
			pSum += r.Perception[k]
			iSum += r.Interest[k]
		}
		n := float64(len(r.Perception))
		if d := r.AvgPerception - float64(pSum)/n; math.Abs(d) > 0.05+1e-9 {
			t.Errorf("round %d: avg perception %v, actual %v", r.Index, r.AvgPerception, float64(pSum)/n)
		}
		if d := r.AvgInterest - float64(iSum)/n; math.Abs(d) > 0.05+1e-9 {
			t.Errorf("round %d: avg interest %v, actual %v", r.Index, r.AvgInterest, float64(iSum)/n)
		}
	}
}

func TestReaders(t *testing.T) {
	g, _ := NewGame(DefaultConfig(2))
	blobs := g.Log().Blobs
	for s, b := range blobs {
		got := g.readers(s)
		if slices.Contains(got, s) {
			t.Fatalf("blob %d reads its own post", s)
		}
		if !slices.IsSorted(got) || len(slices.Compact(slices.Clone(got))) != len(got) {
			t.Fatalf("blob %d: readers not sorted and distinct: %v", s, got)
		}
		if b.Has(Leader) {
			var want []int
			for k, o := range blobs {
				if k != s && o.Shape == b.Shape {
					want = append(want, k)
				}
			}
			if !slices.Equal(got, want) {
				t.Errorf("leader %d reaches %v, want all of shape %s", s, got, b.Shape)
			}
			continue
		}
		want := postReach
		if b.Has(Charismatic) {
			want += 3
		}
		if b.Has(Chatty) {
			want += 3
		}
		if len(got) != want {
			t.Errorf("blob %d (%v) reaches %d readers, want %d", s, b.Traits, len(got), want)
		}
	}
}

// Posts in a two-blob town can't ask for more readers than there are.
func TestReadersTinyTown(t *testing.T) {
	g, err := NewGame(Config{Blobs: 2, Rounds: 20, StoryEvery: 5, Seed: 3})
	if err != nil {
		t.Fatal(err)
	}
	for s := range g.Log().Blobs {
		if got := g.readers(s); len(got) > 1 {
			t.Errorf("blob %d has %d readers in a town of 2", s, len(got))
		}
	}
	for !g.Done() {
		if _, err := g.Choose("bold"); err != nil {
			t.Fatal(err)
		}
	}
}
