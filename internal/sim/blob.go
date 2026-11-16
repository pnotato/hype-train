package sim

import "slices"

// Blob model from docs/BLOBS.md (the master spec). Values marked (design) there
// are drafts; the numbers that tune them live in this package as named
// constants so the design review can find them.

// Shape is a blob's culture. It sets who the blob trusts most, never how much
// it believes (that is credulity).
type Shape string

// Shapes.
const (
	Square   Shape = "square"   // trusts other squares
	Circle   Shape = "circle"   // trusts everyone equally
	Triangle Shape = "triangle" // trusts blobs its own age
	Star     Shape = "star"     // trusts its shape's leader
	Tear     Shape = "tear"     // trusts neighbours, any shape
	Capsule  Shape = "capsule"  // trusts its own family
)

// Shapes lists every shape in a fixed order.
var Shapes = []Shape{Square, Circle, Triangle, Star, Tear, Capsule}

// Valid reports whether s is a known shape.
func (s Shape) Valid() bool {
	return slices.Contains(Shapes, s)
}

// Trait is a personality tag or special trait. A blob has at most one tag per
// category; no tag in a category means average.
type Trait string

// Personality tags, low then high for each category.
const (
	Skeptic      Trait = "skeptic"      // credulity low
	Gullible     Trait = "gullible"     // credulity high
	Quiet        Trait = "quiet"        // socialness low
	Chatty       Trait = "chatty"       // socialness high
	Unconvincing Trait = "unconvincing" // persuasiveness low
	Charismatic  Trait = "charismatic"  // persuasiveness high
)

// Special traits.
const (
	Parent  Trait = "parent"
	Child   Trait = "child"
	Recluse Trait = "recluse" // no in-person talk; social media only
	Leader  Trait = "leader"  // one per shape, always charismatic
)

// Valid reports whether t is a known trait.
func (t Trait) Valid() bool {
	switch t {
	case Skeptic, Gullible, Quiet, Chatty, Unconvincing, Charismatic,
		Parent, Child, Recluse, Leader:
		return true
	}
	return false
}

// Hex is a home cell in axial coordinates. Family members share a home.
type Hex struct {
	Q int `json:"q"`
	R int `json:"r"`
}

// Dist is the number of hex steps between h and o.
func (h Hex) Dist(o Hex) int {
	dq, dr := h.Q-o.Q, h.R-o.R
	return (abs(dq) + abs(dr) + abs(dq+dr)) / 2
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// Blob is one resident. Perception and Interest here are the starting scores;
// per-round scores are in Round.
type Blob struct {
	ID         int     `json:"id"` // index into RunLog.Blobs
	Name       string  `json:"name"`
	Shape      Shape   `json:"shape"`
	Age        int     `json:"age"`
	Traits     []Trait `json:"traits"`
	Family     int     `json:"family,omitempty"` // 0 = no family
	Home       Hex     `json:"home"`
	Perception int     `json:"perception"`
	Interest   int     `json:"interest"`
}

// Has reports whether the blob has trait t.
func (b *Blob) Has(t Trait) bool {
	return slices.Contains(b.Traits, t)
}
