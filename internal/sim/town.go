package sim

import (
	"cmp"
	"errors"
	"fmt"
	"math"
	"math/rand/v2"
	"slices"
)

// Town-building numbers. Age shares are cited in docs/BLOBS.md; the rest are
// (design) drafts.
const (
	startPerception = 50
	startInterest   = 20
	recluseRate     = 0.10 // of adults and elders
	singleParent    = 0.30 // chance a family has one parent
	mixRate         = 0.15 // share of homes swapped so shapes have mixed borders
)

// ageGroups: child / adult / elder, per 100 (Statistics Canada, BLOBS.md [3]).
// Under-5s aren't modelled: they neither read nor talk about companies.
var ageGroups = []struct {
	share, lo, hi int
}{
	{20, 5, 17},
	{60, 18, 64},
	{20, 65, 90},
}

// tagCount is how many personality tags a blob gets: most 2, some 1 or 3.
var tagCount = []weighted[int]{{1, 20}, {2, 60}, {3, 20}}

// categories: low and high tag per category and their relative odds once the
// category is picked. Chatty is rare: a small minority does most sharing.
var categories = [][]weighted[Trait]{
	{{Skeptic, 50}, {Gullible, 50}},
	{{Quiet, 80}, {Chatty, 20}},
	{{Unconvincing, 60}, {Charismatic, 40}},
}

type weighted[T any] struct {
	v T
	w float64
}

func pick[T any](rng *rand.Rand, opts []weighted[T]) T {
	total := 0.0
	for _, o := range opts {
		total += o.w
	}
	r := rng.Float64() * total
	for _, o := range opts {
		if r -= o.w; r < 0 {
			return o.v
		}
	}
	return opts[len(opts)-1].v
}

// BuildTown makes n blobs: ages in Canadian shares, children grouped into
// families with one or two parents, one home per household, shapes dealt
// evenly across households, tags rolled per blob, one leader per shape.
// All randomness comes from rng.
func BuildTown(rng *rand.Rand, n int) ([]Blob, error) {
	if n < 2 {
		return nil, errors.New("town needs at least two blobs")
	}
	if n > len(firstNames)*len(lastNames) {
		return nil, fmt.Errorf("town of %d exceeds the %d available names", n, len(firstNames)*len(lastNames))
	}

	shares := make([]int, len(ageGroups))
	for i, g := range ageGroups {
		shares[i] = g.share
	}
	var children, grownups []int // ages
	for gi, c := range apportion(n, shares) {
		g := ageGroups[gi]
		for range c {
			age := g.lo + rng.IntN(g.hi-g.lo+1)
			if gi == 0 {
				children = append(children, age)
			} else {
				grownups = append(grownups, age)
			}
		}
	}
	rng.Shuffle(len(grownups), func(i, j int) { grownups[i], grownups[j] = grownups[j], grownups[i] })

	// Households: each family is one, every other grown-up lives alone.
	type member struct {
		age    int
		parent bool
	}
	var households [][]member
	adults := slices.DeleteFunc(slices.Clone(grownups), func(a int) bool { return a > 64 })
	elders := slices.DeleteFunc(slices.Clone(grownups), func(a int) bool { return a <= 64 })
	for len(children) > 0 {
		parents := 2
		if rng.Float64() < singleParent {
			parents = 1
		}
		if len(adults) == 0 {
			// Too few adults for a family: remaining children join the last one.
			last := len(households) - 1
			if last < 0 {
				break
			}
			for _, a := range children {
				households[last] = append(households[last], member{age: a})
			}
			children = nil
			break
		}
		parents = min(parents, len(adults))
		kids := min(1+rng.IntN(3), len(children))
		var h []member
		for _, a := range adults[:parents] {
			h = append(h, member{age: a, parent: true})
		}
		for _, a := range children[:kids] {
			h = append(h, member{age: a})
		}
		adults, children = adults[parents:], children[kids:]
		households = append(households, h)
	}
	for _, a := range slices.Concat(adults, elders) {
		households = append(households, []member{{age: a}})
	}
	for _, a := range children { // only if there were no adults at all
		households = append(households, []member{{age: a}})
	}

	// Shapes dealt evenly over shuffled households, then homes laid out in
	// shape bands with some swaps, so neighbourhoods mostly share a shape and
	// border blobs bridge them.
	rng.Shuffle(len(households), func(i, j int) { households[i], households[j] = households[j], households[i] })
	shapeOf := make([]Shape, len(households))
	for i := range households {
		shapeOf[i] = Shapes[i%len(Shapes)]
	}
	order := make([]int, len(households))
	for i := range order {
		order[i] = i
	}
	slices.SortStableFunc(order, func(a, b int) int {
		return cmp.Compare(slices.Index(Shapes, shapeOf[a]), slices.Index(Shapes, shapeOf[b]))
	})
	for range int(mixRate * float64(len(order))) {
		i, j := rng.IntN(len(order)), rng.IntN(len(order))
		order[i], order[j] = order[j], order[i]
	}
	width := int(math.Ceil(math.Sqrt(float64(len(order)))))
	home := make([]Hex, len(households))
	for cell, h := range order {
		col, row := cell%width, cell/width
		home[h] = Hex{Q: col - (row-row&1)/2, R: row}
	}

	names := drawNames(rng, n)
	blobs := make([]Blob, 0, n)
	family := 0
	for h, ms := range households {
		fam := 0
		if len(ms) > 1 {
			family++
			fam = family
		}
		for _, m := range ms {
			b := Blob{
				ID:         len(blobs),
				Name:       names[len(blobs)],
				Shape:      shapeOf[h],
				Age:        m.age,
				Traits:     rollTags(rng),
				Family:     fam,
				Home:       home[h],
				Perception: startPerception,
				Interest:   startInterest,
			}
			switch {
			case m.parent:
				b.Traits = append(b.Traits, Parent)
			case m.age < 18:
				b.Traits = append(b.Traits, Child)
			}
			if m.age >= 18 && rng.Float64() < recluseRate {
				b.Traits = append(b.Traits, Recluse)
			}
			blobs = append(blobs, b)
		}
	}

	// One leader per shape: a non-recluse adult, made charismatic.
	for _, s := range Shapes {
		var cands []int
		for i, b := range blobs {
			if b.Shape == s && b.Age >= 18 && !b.Has(Recluse) {
				cands = append(cands, i)
			}
		}
		if len(cands) == 0 {
			continue
		}
		b := &blobs[cands[rng.IntN(len(cands))]]
		b.Traits = slices.DeleteFunc(b.Traits, func(t Trait) bool { return t == Unconvincing })
		if !b.Has(Charismatic) {
			b.Traits = append(b.Traits, Charismatic)
		}
		b.Traits = append(b.Traits, Leader)
	}
	return blobs, nil
}

// rollTags picks 1–3 categories and one tag in each.
func rollTags(rng *rand.Rand) []Trait {
	k := pick(rng, tagCount)
	var tags []Trait
	for _, c := range rng.Perm(len(categories))[:k] {
		tags = append(tags, pick(rng, categories[c]))
	}
	slices.Sort(tags)
	return tags
}

// apportion splits n into counts proportional to shares by the largest
// remainder method. Ties go to the earlier share, so it is deterministic.
func apportion(n int, shares []int) []int {
	total := 0
	for _, s := range shares {
		total += s
	}
	counts := make([]int, len(shares))
	rems := make([]int, len(shares))
	left := n
	for i, s := range shares {
		counts[i] = n * s / total
		rems[i] = n * s % total
		left -= counts[i]
	}
	order := make([]int, len(shares))
	for i := range order {
		order[i] = i
	}
	slices.SortStableFunc(order, func(a, b int) int { return cmp.Compare(rems[b], rems[a]) })
	for _, i := range order[:left] {
		counts[i]++
	}
	return counts
}

// drawNames returns n distinct fictional names.
func drawNames(rng *rand.Rand, n int) []string {
	seen := map[string]bool{}
	names := make([]string, 0, n)
	for len(names) < n {
		name := firstNames[rng.IntN(len(firstNames))] + " " + lastNames[rng.IntN(len(lastNames))]
		if !seen[name] {
			seen[name] = true
			names = append(names, name)
		}
	}
	return names
}

var firstNames = []string{
	"Marla", "Dex", "Juno", "Otis", "Wren", "Ike", "Bram", "Cleo", "Dot", "Eli",
	"Fern", "Gus", "Hattie", "Ivo", "Jessa", "Kit", "Lark", "Moss", "Nell", "Odie",
	"Pim", "Quill", "Rosa", "Sully", "Tamsin", "Ulla", "Vern", "Willa", "Xan", "Yara",
	"Zeb", "Amos", "Bea", "Cass", "Dell", "Effie", "Flint", "Greta", "Hal", "Iris",
}

var lastNames = []string{
	"Penhallow", "Arroway", "Vale", "Brannock", "Halloway", "Somersby", "Ashgrove", "Bellwether",
	"Cobble", "Dunmore", "Elderby", "Fairweather", "Gristle", "Hobbs", "Inkwell", "Juniper",
	"Kettering", "Larkspur", "Merriweather", "Nettlefield", "Oakes", "Pemberton", "Quarry",
	"Rookwood", "Saltmarsh", "Thistle", "Underhill", "Vantwood", "Whitlock", "Yarrow",
	"Brightwater", "Crumb", "Dappleby", "Fennick", "Gorse", "Hearth", "Mallow", "Pickering",
	"Rumbold", "Tolliver",
}
