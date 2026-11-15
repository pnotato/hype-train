package sim

import (
	"cmp"
	"errors"
	"fmt"
	"math/rand/v2"
	"slices"
	"strconv"
)

// jitterRate is the chance that each non-defining ordinal trait moves one step
// from its archetype default, so two residents of one archetype differ.
const jitterRate = 0.2

// BuildRoster makes n residents. Archetype and age counts follow the shares in
// archetypes and ageShares exactly (largest remainder), and are drawn
// independently of each other. All randomness comes from rng.
func BuildRoster(rng *rand.Rand, n int) ([]AgentProfile, error) {
	if n < 1 {
		return nil, errors.New("roster needs at least one resident")
	}
	if n > len(firstNames)*len(lastNames) {
		return nil, fmt.Errorf("roster of %d exceeds the %d available names", n, len(firstNames)*len(lastNames))
	}

	type persona struct {
		archetype Archetype
		variant   Variant
	}
	var personas []persona
	for i, c := range apportion(n, archetypeShares()) {
		a := archetypes[i].archetype
		for k := range c {
			p := persona{archetype: a}
			if a == CloutChaser {
				// Split evenly; the extra one in an odd count is a True Believer.
				p.variant = Cynic
				if k < (c+1)/2 {
					p.variant = TrueBeliever
				}
			}
			personas = append(personas, p)
		}
	}
	rng.Shuffle(len(personas), func(i, j int) { personas[i], personas[j] = personas[j], personas[i] })

	var ages []AgeGroup
	for i, c := range apportion(n, ageShareValues()) {
		for range c {
			ages = append(ages, ageShares[i].age)
		}
	}
	rng.Shuffle(len(ages), func(i, j int) { ages[i], ages[j] = ages[j], ages[i] })

	width := max(2, len(strconv.Itoa(n)))
	names := drawNames(rng, n)
	rs := make([]AgentProfile, n)
	socs := make([]Level, n)
	for i, p := range personas {
		t := traitsFor(rng, p.archetype, p.variant)
		socs[i] = t.Sociability
		rs[i] = AgentProfile{
			ID:          fmt.Sprintf("res-%0*d", width, i+1),
			Name:        names[i],
			Kind:        KindResident,
			AgeGroup:    ages[i],
			Archetype:   p.archetype,
			Variant:     p.variant,
			Traits:      &t,
			Follows:     follows(ages[i], t.Sociability),
			StartBelief: Calm,
		}
	}

	for i, nbrs := range buildGraph(rng, socs) {
		for _, j := range nbrs {
			rs[i].Neighbors = append(rs[i].Neighbors, rs[j].ID)
		}
		slices.Sort(rs[i].Neighbors)
	}
	return rs, nil
}

func archetypeShares() []int {
	s := make([]int, len(archetypes))
	for i, a := range archetypes {
		s[i] = a.share
	}
	return s
}

func ageShareValues() []int {
	s := make([]int, len(ageShares))
	for i, a := range ageShares {
		s[i] = a.share
	}
	return s
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

func traitsFor(rng *rand.Rand, a Archetype, v Variant) Traits {
	spec, _ := archetypeByName(a)
	t := spec.traits
	if v != "" {
		t.Credulity = variantCredulity[v]
	}
	for _, tr := range []trait{credulity, broadcast, reactivity, sociability} {
		if slices.Contains(spec.fixed, tr) || rng.Float64() >= jitterRate {
			continue
		}
		l := t.level(tr)
		step := 1
		if rng.IntN(2) == 0 {
			step = -1
		}
		i := l.index() + step
		if i < 0 || i >= len(levelOrder) {
			i = l.index() - step
		}
		*l = levelOrder[i]
	}
	return t
}

// follows is the resident's source diet. Younger residents lean to the
// clickbait site, older ones to the paper; loners follow nothing and hear only
// from their few neighbours.
func follows(age AgeGroup, soc Level) []string {
	if soc == Low {
		return nil
	}
	switch age {
	case Young:
		return []string{OutletClickbait}
	case Adult:
		return []string{OutletPaper, OutletClickbait}
	default:
		return []string{OutletPaper}
	}
}

// degreeBand is the [min, max] neighbour count for a sociability level. High
// has no real max: connectors also absorb top-up links.
func degreeBand(l Level) (int, int) {
	switch l {
	case Low:
		return 1, 2
	case Mid:
		return 3, 5
	default:
		return 8, 10
	}
}

// buildGraph returns an undirected neighbour list per resident. Each resident
// draws a target degree from its sociability band; links are made greedily
// between residents still under target, then anyone below their band's
// minimum is topped up from non-loners so loners never exceed their max.
func buildGraph(rng *rand.Rand, socs []Level) [][]int {
	n := len(socs)
	adj := make([][]int, n)
	linked := func(i, j int) bool { return slices.Contains(adj[i], j) }
	link := func(i, j int) {
		adj[i] = append(adj[i], j)
		adj[j] = append(adj[j], i)
	}

	target := make([]int, n)
	for i, s := range socs {
		lo, hi := degreeBand(s)
		target[i] = min(lo+rng.IntN(hi-lo+1), n-1)
	}

	pick := func(i int, ok func(j int) bool) bool {
		var cands []int
		for j := range n {
			if j != i && !linked(i, j) && ok(j) {
				cands = append(cands, j)
			}
		}
		if len(cands) == 0 {
			return false
		}
		link(i, cands[rng.IntN(len(cands))])
		return true
	}

	order := rng.Perm(n)
	for _, i := range order {
		for len(adj[i]) < target[i] && pick(i, func(j int) bool { return len(adj[j]) < target[j] }) {
		}
	}
	for _, i := range order {
		lo, _ := degreeBand(socs[i])
		for len(adj[i]) < min(lo, n-1) {
			if !pick(i, func(j int) bool { return socs[j] != Low }) &&
				!pick(i, func(int) bool { return true }) {
				break
			}
		}
	}
	return adj
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
