package sim

import "testing"

func TestShapeValid(t *testing.T) {
	for _, s := range Shapes {
		if !s.Valid() {
			t.Errorf("%q should be valid", s)
		}
	}
	for _, s := range []Shape{"", "hexagon", "Square"} {
		if s.Valid() {
			t.Errorf("%q should be invalid", s)
		}
	}
}

func TestTraitValid(t *testing.T) {
	for _, tr := range []Trait{Skeptic, Gullible, Quiet, Chatty, Unconvincing, Charismatic, Parent, Child, Recluse, Leader} {
		if !tr.Valid() {
			t.Errorf("%q should be valid", tr)
		}
	}
	for _, tr := range []Trait{"", "brave", "Leader"} {
		if tr.Valid() {
			t.Errorf("%q should be invalid", tr)
		}
	}
}

func TestHexDist(t *testing.T) {
	o := Hex{0, 0}
	tests := []struct {
		h    Hex
		want int
	}{
		{Hex{0, 0}, 0},
		{Hex{1, 0}, 1}, {Hex{0, 1}, 1}, {Hex{-1, 1}, 1}, // neighbours
		{Hex{1, -1}, 1}, {Hex{-1, 0}, 1}, {Hex{0, -1}, 1},
		{Hex{1, 1}, 2}, // not a neighbour in axial coordinates
		{Hex{3, -3}, 3},
		{Hex{2, 3}, 5},
		{Hex{-4, 1}, 4},
	}
	for _, tt := range tests {
		if got := o.Dist(tt.h); got != tt.want {
			t.Errorf("Dist(%v) = %d, want %d", tt.h, got, tt.want)
		}
	}
}

func TestHexDistMetric(t *testing.T) {
	var cells []Hex
	for q := -3; q <= 3; q++ {
		for r := -3; r <= 3; r++ {
			cells = append(cells, Hex{q, r})
		}
	}
	for _, a := range cells {
		for _, b := range cells {
			if a.Dist(b) != b.Dist(a) {
				t.Fatalf("Dist not symmetric for %v, %v", a, b)
			}
			if (a.Dist(b) == 0) != (a == b) {
				t.Fatalf("Dist(%v, %v) = %d", a, b, a.Dist(b))
			}
			for _, c := range cells {
				if a.Dist(c) > a.Dist(b)+b.Dist(c) {
					t.Fatalf("triangle inequality fails for %v, %v, %v", a, b, c)
				}
			}
		}
	}
}

func TestBlobHas(t *testing.T) {
	b := Blob{Traits: []Trait{Chatty, Leader}}
	if !b.Has(Chatty) || !b.Has(Leader) || b.Has(Quiet) {
		t.Errorf("Has wrong for %v", b.Traits)
	}
	if (&Blob{}).Has(Chatty) {
		t.Error("blob with no traits has Chatty")
	}
}
