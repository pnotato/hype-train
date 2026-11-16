package sim

import (
	"math"
	"math/rand/v2"
	"reflect"
	"slices"
	"testing"
)

func TestApportion(t *testing.T) {
	tests := []struct {
		n      int
		shares []int
		want   []int
	}{
		{100, []int{20, 60, 20}, []int{20, 60, 20}},
		{10, []int{20, 60, 20}, []int{2, 6, 2}},
		{2, []int{20, 60, 20}, []int{1, 1, 0}}, // tie on remainder goes to the earlier share
		{7, []int{1, 1, 1}, []int{3, 2, 2}},
		{0, []int{1, 2}, []int{0, 0}},
		{5, []int{1}, []int{5}},
	}
	for _, tt := range tests {
		if got := apportion(tt.n, tt.shares); !slices.Equal(got, tt.want) {
			t.Errorf("apportion(%d, %v) = %v, want %v", tt.n, tt.shares, got, tt.want)
		}
	}
}

func TestApportionSums(t *testing.T) {
	for n := range 300 {
		sum := 0
		for _, c := range apportion(n, []int{20, 60, 20}) {
			sum += c
		}
		if sum != n {
			t.Fatalf("apportion(%d) sums to %d", n, sum)
		}
	}
}

func TestPick(t *testing.T) {
	rng := rand.New(rand.NewPCG(1, 2))
	opts := []weighted[string]{{"never", 0}, {"a", 1}, {"b", 3}}
	counts := map[string]int{}
	const n = 20000
	for range n {
		counts[pick(rng, opts)]++
	}
	if counts["never"] != 0 {
		t.Errorf("zero-weight option picked %d times", counts["never"])
	}
	if got := float64(counts["b"]) / n; math.Abs(got-0.75) > 0.02 {
		t.Errorf("b picked %.3f of the time, want ~0.75", got)
	}
	if got := pick(rng, []weighted[int]{{42, 1}}); got != 42 {
		t.Errorf("single option: got %d", got)
	}
}

func TestBuildTownErrors(t *testing.T) {
	rng := rand.New(rand.NewPCG(1, 0))
	for _, n := range []int{-1, 0, 1, len(firstNames)*len(lastNames) + 1} {
		if _, err := BuildTown(rng, n); err == nil {
			t.Errorf("BuildTown(%d) should fail", n)
		}
	}
}

func TestBuildTownDeterministic(t *testing.T) {
	a, _ := BuildTown(rand.New(rand.NewPCG(5, 0)), 100)
	b, _ := BuildTown(rand.New(rand.NewPCG(5, 0)), 100)
	if !reflect.DeepEqual(a, b) {
		t.Fatal("same seed built different towns")
	}
	c, _ := BuildTown(rand.New(rand.NewPCG(6, 0)), 100)
	if reflect.DeepEqual(a, c) {
		t.Fatal("different seeds built identical towns")
	}
}

// Towns of every small size and a few large ones stay well formed.
func TestBuildTownSizes(t *testing.T) {
	for _, n := range slices.Concat(seq(2, 40), []int{99, 101, 200, 500}) {
		for seed := range uint64(5) {
			blobs, err := BuildTown(rand.New(rand.NewPCG(seed, 0)), n)
			if err != nil {
				t.Fatalf("n=%d seed=%d: %v", n, seed, err)
			}
			checkTown(t, n, blobs)
		}
	}
}

func checkTown(t *testing.T, n int, blobs []Blob) {
	t.Helper()
	if len(blobs) != n {
		t.Fatalf("n=%d: got %d blobs", n, len(blobs))
	}
	names := map[string]bool{}
	homes := map[Hex]int{} // home → family (0 for a single)
	for i, b := range blobs {
		if b.ID != i || names[b.Name] || !b.Shape.Valid() {
			t.Fatalf("n=%d: bad blob %+v", n, b)
		}
		names[b.Name] = true
		if b.Age < 5 || b.Age > 90 {
			t.Errorf("n=%d: blob %d aged %d", n, i, b.Age)
		}
		if b.Perception != startPerception || b.Interest != startInterest {
			t.Errorf("n=%d: blob %d starts at %d/%d", n, i, b.Perception, b.Interest)
		}
		if b.Has(Child) != (b.Age < 18) {
			t.Errorf("n=%d: blob %d aged %d, child=%v", n, i, b.Age, b.Has(Child))
		}
		if b.Has(Parent) && (b.Age < 18 || b.Age > 64 || b.Family == 0) {
			t.Errorf("n=%d: bad parent %+v", n, b)
		}
		if b.Has(Recluse) && b.Age < 18 {
			t.Errorf("n=%d: child recluse %+v", n, b)
		}
		// Two households never share a home.
		if f, ok := homes[b.Home]; ok && (f == 0 || f != b.Family) {
			t.Errorf("n=%d: blob %d shares home %v with another household", n, i, b.Home)
		}
		homes[b.Home] = b.Family
	}
}

func seq(lo, hi int) []int {
	var out []int
	for i := lo; i <= hi; i++ {
		out = append(out, i)
	}
	return out
}

// Shapes are dealt evenly over households, so no shape has far more homes than another.
func TestBuildTownShapesEven(t *testing.T) {
	blobs, _ := BuildTown(rand.New(rand.NewPCG(3, 0)), 120)
	homes := map[Shape]map[Hex]bool{}
	for _, b := range blobs {
		if homes[b.Shape] == nil {
			homes[b.Shape] = map[Hex]bool{}
		}
		homes[b.Shape][b.Home] = true
	}
	lo, hi := math.MaxInt, 0
	for _, s := range Shapes {
		lo, hi = min(lo, len(homes[s])), max(hi, len(homes[s]))
	}
	if hi-lo > 1 {
		t.Errorf("households per shape range %d–%d, want within 1", lo, hi)
	}
}

func TestRollTags(t *testing.T) {
	rng := rand.New(rand.NewPCG(9, 0))
	sizes := map[int]int{}
	for range 2000 {
		tags := rollTags(rng)
		sizes[len(tags)]++
		if !slices.IsSorted(tags) {
			t.Fatalf("tags not sorted: %v", tags)
		}
		for _, cat := range categories {
			inCat := 0
			for _, tr := range tags {
				if slices.ContainsFunc(cat, func(w weighted[Trait]) bool { return w.v == tr }) {
					inCat++
				}
			}
			if inCat > 1 {
				t.Fatalf("two tags from one category: %v", tags)
			}
		}
	}
	for k := 1; k <= 3; k++ {
		if sizes[k] == 0 {
			t.Errorf("never rolled %d tags", k)
		}
	}
	if len(sizes) != 3 {
		t.Errorf("tag counts %v, want only 1–3", sizes)
	}
}

func TestDrawNames(t *testing.T) {
	all := len(firstNames) * len(lastNames)
	names := drawNames(rand.New(rand.NewPCG(1, 0)), all)
	seen := map[string]bool{}
	for _, n := range names {
		if seen[n] {
			t.Fatalf("duplicate name %q", n)
		}
		seen[n] = true
	}
	if len(names) != all {
		t.Fatalf("got %d names, want %d", len(names), all)
	}
}
