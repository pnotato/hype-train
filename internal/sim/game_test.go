package sim

import (
	"encoding/json"
	"math/rand/v2"
	"reflect"
	"slices"
	"testing"
)

func play(t testing.TB, seed uint64, choice string) *Game {
	t.Helper()
	g, err := NewGame(DefaultConfig(seed))
	if err != nil {
		t.Fatal(err)
	}
	for !g.Done() {
		if _, err := g.Choose(choice); err != nil {
			t.Fatal(err)
		}
	}
	return g
}

func TestBuildTown(t *testing.T) {
	blobs, err := BuildTown(rand.New(rand.NewPCG(1, 0)), 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(blobs) != 100 {
		t.Fatalf("got %d blobs", len(blobs))
	}
	ages := [3]int{}
	leaders := map[Shape]int{}
	families := map[int][]Blob{}
	names := map[string]bool{}
	for i, b := range blobs {
		if b.ID != i || names[b.Name] || !b.Shape.Valid() {
			t.Errorf("bad blob %+v", b)
		}
		names[b.Name] = true
		switch {
		case b.Age < 18:
			ages[0]++
			if b.Family == 0 || !b.Has(Child) {
				t.Errorf("child %d has no family", i)
			}
		case b.Age < 65:
			ages[1]++
		default:
			ages[2]++
		}
		perCategory := [3]int{}
		for _, tr := range b.Traits {
			if !tr.Valid() {
				t.Errorf("blob %d: bad trait %q", i, tr)
			}
			for c, cat := range categories {
				if slices.ContainsFunc(cat, func(w weighted[Trait]) bool { return w.v == tr }) {
					perCategory[c]++
				}
			}
		}
		if slices.Max(perCategory[:]) > 1 {
			t.Errorf("blob %d: two tags in one category: %v", i, b.Traits)
		}
		if b.Has(Leader) {
			leaders[b.Shape]++
			if !b.Has(Charismatic) || b.Has(Recluse) || b.Age < 18 {
				t.Errorf("bad leader %+v", b)
			}
		}
		if b.Family != 0 {
			families[b.Family] = append(families[b.Family], b)
		}
	}
	if ages != [3]int{20, 60, 20} {
		t.Errorf("age groups %v, want 20/60/20", ages)
	}
	for _, s := range Shapes {
		if leaders[s] != 1 {
			t.Errorf("%s has %d leaders", s, leaders[s])
		}
	}
	for f, ms := range families {
		parents := 0
		for _, m := range ms {
			if m.Shape != ms[0].Shape || m.Home != ms[0].Home {
				t.Errorf("family %d split across shapes or homes", f)
			}
			if m.Has(Parent) {
				parents++
			}
		}
		if parents < 1 || parents > 2 || len(ms) == parents {
			t.Errorf("family %d: %d parents of %d members", f, parents, len(ms))
		}
	}
}

func TestGameDeterministic(t *testing.T) {
	a, b := play(t, 7, "bold").Log(), play(t, 7, "bold").Log()
	if !reflect.DeepEqual(a, b) {
		t.Fatal("same seed and choices gave different logs")
	}
	if reflect.DeepEqual(a, play(t, 8, "bold").Log()) {
		t.Fatal("different seeds gave identical logs")
	}
}

func TestReplay(t *testing.T) {
	g := play(t, 3, "modest")
	var choices []string
	for _, c := range g.Log().Choices {
		choices = append(choices, c.Story)
	}
	r, err := Replay(g.Log().Config, choices)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(g.Log(), r.Log()) {
		t.Fatal("replay differs from the original run")
	}
}

func TestGameShape(t *testing.T) {
	g := play(t, 11, "bold")
	log := g.Log()
	if len(log.Rounds) != 50 || len(log.Choices) != 5 || g.Options() != nil {
		t.Fatalf("rounds %d, choices %d", len(log.Rounds), len(log.Choices))
	}
	if _, err := g.Choose("bold"); err == nil {
		t.Error("choosing after the end should fail")
	}
	for k, c := range log.Choices {
		if c.Round != k*10+1 {
			t.Errorf("choice %d at round %d", k, c.Round)
		}
	}
}

func TestGameInvariants(t *testing.T) {
	log := play(t, 5, "bold").Log()
	blobs := log.Blobs
	p, i := make([]int, len(blobs)), make([]int, len(blobs))
	for k, b := range blobs {
		p[k], i[k] = b.Perception, b.Interest
	}
	ids := map[string]bool{}
	talks, posts := 0, 0
	for ri, r := range log.Rounds {
		if r.Index != ri+1 {
			t.Fatalf("round %d has index %d", ri+1, r.Index)
		}
		inTalk := map[int]bool{}
		for _, e := range r.Events {
			if ids[e.ID] {
				t.Errorf("duplicate event id %s", e.ID)
			}
			ids[e.ID] = true
			if (e.Kind == KindStory) != (r.Index%10 == 1 && e.From == Company) {
				t.Errorf("%s: story event out of place", e.ID)
			}
			if len(e.To) != len(e.Effects) {
				t.Errorf("%s: %d recipients, %d effects", e.ID, len(e.To), len(e.Effects))
			}
			switch e.Kind {
			case KindTalk:
				talks++
				for _, b := range []int{e.From, e.To[0]} {
					if blobs[b].Has(Recluse) {
						t.Errorf("%s: recluse %d talked in person", e.ID, b)
					}
					if inTalk[b] {
						t.Errorf("%s: blob %d in two talks", e.ID, b)
					}
					inTalk[b] = true
				}
			case KindPost:
				posts++
				if blobs[e.From].Age < underPosting {
					t.Errorf("%s: blob aged %d posted", e.ID, blobs[e.From].Age)
				}
			}
			for k, f := range e.Effects {
				if f.Blob != e.To[k] || f.Blob == e.From {
					t.Errorf("%s: effect on %d, recipient %d", e.ID, f.Blob, e.To[k])
				}
				if f.Perception < 0 || f.Perception > 100 || f.Interest < 0 || f.Interest > 100 {
					t.Errorf("%s: score out of range %+v", e.ID, f)
				}
				p[f.Blob], i[f.Blob] = f.Perception, f.Interest
			}
		}
		// Perception only changes through events; interest also fades.
		for k := range blobs {
			if r.Perception[k] != p[k] {
				t.Errorf("round %d blob %d: perception %d without an event (was %d)",
					r.Index, k, r.Perception[k], p[k])
			}
			if r.Interest[k] > i[k] {
				t.Errorf("round %d blob %d: interest %d → %d without an event", r.Index, k, i[k], r.Interest[k])
			}
			p[k], i[k] = r.Perception[k], r.Interest[k]
		}
	}
	if talks == 0 || posts == 0 {
		t.Errorf("talks %d, posts %d: want both", talks, posts)
	}
}

// A bold story should raise interest more than an honest one.
func TestStoriesMoveScores(t *testing.T) {
	last := func(g *Game) Round { return g.Log().Rounds[len(g.Log().Rounds)-1] }
	bold, honest := last(play(t, 9, "bold")), last(play(t, 9, "honest"))
	if bold.AvgInterest <= honest.AvgInterest {
		t.Errorf("interest: bold %.1f, honest %.1f", bold.AvgInterest, honest.AvgInterest)
	}
	if bold.AvgInterest <= startInterest {
		t.Errorf("bold run ended with interest %.1f, below the start", bold.AvgInterest)
	}
}

func TestLogJSONRoundTrip(t *testing.T) {
	log := play(t, 2, "modest").Log()
	b, err := json.Marshal(log)
	if err != nil {
		t.Fatal(err)
	}
	var back RunLog
	if err := json.Unmarshal(b, &back); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(*log, back) {
		t.Fatal("log changed after JSON round-trip")
	}
}

func BenchmarkFullRun(b *testing.B) {
	for b.Loop() {
		play(b, 1, "bold")
	}
}
