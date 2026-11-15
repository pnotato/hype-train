package sim

import (
	"encoding/json"
	"math/rand/v2"
	"reflect"
	"slices"
	"testing"
)

func roster(t *testing.T, seed uint64, n int) []AgentProfile {
	t.Helper()
	rs, err := BuildRoster(rand.New(rand.NewPCG(seed, 0)), n)
	if err != nil {
		t.Fatalf("BuildRoster(%d): %v", n, err)
	}
	if len(rs) != n {
		t.Fatalf("got %d residents, want %d", len(rs), n)
	}
	return rs
}

func TestBuildRosterDeterministic(t *testing.T) {
	a, b := roster(t, 7, 100), roster(t, 7, 100)
	if !reflect.DeepEqual(a, b) {
		t.Fatal("same seed produced different rosters")
	}
	if reflect.DeepEqual(a, roster(t, 8, 100)) {
		t.Fatal("different seeds produced identical rosters")
	}
}

func TestBuildRosterRejectsEmpty(t *testing.T) {
	if _, err := BuildRoster(rand.New(rand.NewPCG(1, 0)), 0); err == nil {
		t.Fatal("want error for n=0")
	}
}

func TestBuildRosterShares(t *testing.T) {
	rs := roster(t, 1, 100)
	arch := map[Archetype]int{}
	age := map[AgeGroup]int{}
	variant := map[Variant]int{}
	for _, r := range rs {
		arch[r.Archetype]++
		age[r.AgeGroup]++
		variant[r.Variant]++
	}
	for _, s := range archetypes {
		if arch[s.archetype] != s.share {
			t.Errorf("%s: got %d, want %d", s.archetype, arch[s.archetype], s.share)
		}
	}
	for _, s := range ageShares {
		if age[s.age] != s.share {
			t.Errorf("%s: got %d, want %d", s.age, age[s.age], s.share)
		}
	}
	if variant[TrueBeliever] != 5 || variant[Cynic] != 5 {
		t.Errorf("clout-chaser variants: got %v, want 5/5", variant)
	}
}

func TestBuildRosterSmallN(t *testing.T) {
	// Counts must still sum to n and every resident must be valid.
	for _, n := range []int{1, 7, 12, 33} {
		rs := roster(t, 3, n)
		for _, r := range rs {
			if !r.Archetype.Valid() || !r.AgeGroup.Valid() {
				t.Errorf("n=%d: invalid resident %+v", n, r)
			}
		}
	}
}

func TestBuildRosterResidentsValid(t *testing.T) {
	rs := roster(t, 2, 100)
	ids, names := map[string]bool{}, map[string]bool{}
	for _, r := range rs {
		if ids[r.ID] || names[r.Name] {
			t.Errorf("duplicate id or name: %s %q", r.ID, r.Name)
		}
		ids[r.ID], names[r.Name] = true, true
		if r.Kind != KindResident || r.StartBelief != Calm || r.Traits == nil ||
			!r.Traits.Valid() || !r.Variant.Valid() {
			t.Errorf("invalid resident %+v", r)
		}
		if (r.Archetype == CloutChaser) != (r.Variant != "") {
			t.Errorf("%s: variant %q on archetype %s", r.ID, r.Variant, r.Archetype)
		}
	}
}

func TestBuildRosterTraits(t *testing.T) {
	rs := roster(t, 4, 100)
	jittered, jitterable := 0, 0
	for _, r := range rs {
		spec, _ := archetypeByName(r.Archetype)
		def := spec.traits
		if r.Variant != "" {
			def.Credulity = variantCredulity[r.Variant]
		}
		// Categorical traits never jitter.
		if r.Traits.Distortion != def.Distortion || r.Traits.Motive != def.Motive {
			t.Errorf("%s: categorical traits changed: %+v", r.ID, r.Traits)
		}
		for _, tr := range []trait{credulity, broadcast, reactivity, sociability} {
			got, want := r.Traits.level(tr).index(), def.level(tr).index()
			if slices.Contains(spec.fixed, tr) {
				if got != want {
					t.Errorf("%s: fixed trait %d changed %d→%d", r.ID, tr, want, got)
				}
				continue
			}
			jitterable++
			switch got - want {
			case 0:
			case -1, 1:
				jittered++
			default:
				t.Errorf("%s: trait %d moved more than one step", r.ID, tr)
			}
		}
	}
	// About 20% of jitterable traits should move.
	if frac := float64(jittered) / float64(jitterable); frac < 0.1 || frac > 0.3 {
		t.Errorf("jitter rate %.2f, want about 0.2", frac)
	}
}

func TestBuildRosterGraph(t *testing.T) {
	rs := roster(t, 5, 100)
	byID := map[string]AgentProfile{}
	for _, r := range rs {
		byID[r.ID] = r
	}
	degSum := map[Level]int{}
	degN := map[Level]int{}
	for _, r := range rs {
		d := len(r.Neighbors)
		if d == 0 {
			t.Errorf("%s has no neighbours", r.ID)
		}
		if !slices.IsSorted(r.Neighbors) || len(slices.Compact(slices.Clone(r.Neighbors))) != d {
			t.Errorf("%s neighbours not sorted and unique: %v", r.ID, r.Neighbors)
		}
		for _, n := range r.Neighbors {
			if n == r.ID {
				t.Errorf("%s is its own neighbour", r.ID)
			}
			if !slices.Contains(byID[n].Neighbors, r.ID) {
				t.Errorf("edge %s→%s is not symmetric", r.ID, n)
			}
		}
		soc := r.Traits.Sociability
		switch {
		case soc == Low && d > 2:
			t.Errorf("%s: low sociability with degree %d", r.ID, d)
		case soc == High && d < 8:
			t.Errorf("%s: high sociability with degree %d", r.ID, d)
		}
		degSum[soc] += d
		degN[soc]++
	}
	avg := func(l Level) float64 { return float64(degSum[l]) / float64(degN[l]) }
	if !(avg(Low) < avg(Mid) && avg(Mid) < avg(High)) {
		t.Errorf("mean degree not ordered by sociability: low %.1f mid %.1f high %.1f",
			avg(Low), avg(Mid), avg(High))
	}
}

func TestBuildRosterFollows(t *testing.T) {
	want := map[AgeGroup][]string{
		Young:  {OutletClickbait},
		Adult:  {OutletPaper, OutletClickbait},
		Middle: {OutletPaper},
		Senior: {OutletPaper},
	}
	for _, r := range roster(t, 6, 100) {
		w := want[r.AgeGroup]
		if r.Traits.Sociability == Low {
			w = nil
		}
		if !slices.Equal(r.Follows, w) {
			t.Errorf("%s (%s, sociability %s): follows %v, want %v",
				r.ID, r.AgeGroup, r.Traits.Sociability, r.Follows, w)
		}
	}
}

func TestBuildRosterJSONRoundTrip(t *testing.T) {
	rs := roster(t, 9, 100)
	b, err := json.Marshal(rs)
	if err != nil {
		t.Fatal(err)
	}
	var back []AgentProfile
	if err := json.Unmarshal(b, &back); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(rs, back) {
		t.Fatal("roster changed after JSON round-trip")
	}
}
