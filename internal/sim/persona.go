package sim

// Persona model: one age group, one archetype, six trait words. The evidence
// behind each axis is in docs/PLAN.md ("Persona evidence"). Behaviour code
// (stub brain, prompts) must read Traits, never Archetype, so adding an
// archetype only means adding a row to archetypes.

// AgeGroup uses Pew's adult age brackets so shares can be checked against
// survey data. It shapes source diet and channel, not credulity.
type AgeGroup string

// Age groups.
const (
	Young  AgeGroup = "young"  // 18–29
	Adult  AgeGroup = "adult"  // 30–49
	Middle AgeGroup = "middle" // 50–64
	Senior AgeGroup = "senior" // 65+
)

// Valid reports whether a is a known age group.
func (a AgeGroup) Valid() bool {
	switch a {
	case Young, Adult, Middle, Senior:
		return true
	}
	return false
}

// Archetype is the resident's readable personality. It picks default traits
// and the accessory in the UI.
type Archetype string

// Archetypes.
const (
	Regular     Archetype = "regular"
	Connector   Archetype = "connector"
	Worrier     Archetype = "worrier"
	Skeptic     Archetype = "skeptic"
	CloutChaser Archetype = "clout-chaser"
	Hermit      Archetype = "hermit"
)

// Valid reports whether a is a known archetype.
func (a Archetype) Valid() bool {
	_, ok := archetypeByName(a)
	return ok
}

// Variant splits clout-chasers by whether they believe what they post.
type Variant string

// Clout-chaser variants. Other archetypes have no variant ("").
const (
	TrueBeliever Variant = "true-believer"
	Cynic        Variant = "cynic"
)

// Valid reports whether v is empty or a known variant.
func (v Variant) Valid() bool {
	return v == "" || v == TrueBeliever || v == Cynic
}

// Level is an ordinal trait word.
type Level string

// Levels, in order.
const (
	Low  Level = "low"
	Mid  Level = "mid"
	High Level = "high"
)

var levelOrder = []Level{Low, Mid, High}

// Valid reports whether l is a known level.
func (l Level) Valid() bool {
	return l == Low || l == Mid || l == High
}

func (l Level) index() int {
	for i, v := range levelOrder {
		if v == l {
			return i
		}
	}
	return -1
}

// Distortion is how a resident rewrites a story when passing it on
// (Allport & Postman, 1947).
type Distortion string

// Distortion styles.
const (
	Leveling     Distortion = "level" // drops details
	Sharpening   Distortion = "sharpen"
	Assimilation Distortion = "assimilate"
)

// Valid reports whether d is a known distortion style.
func (d Distortion) Valid() bool {
	return d == Leveling || d == Sharpening || d == Assimilation
}

// Motive is why a resident shares at all.
type Motive string

// Motives.
const (
	Inform Motive = "inform"
	Warn   Motive = "warn"
	Clout  Motive = "clout"
)

// Valid reports whether m is a known motive.
func (m Motive) Valid() bool {
	return m == Inform || m == Warn || m == Clout
}

// Traits are the words that drive behaviour.
type Traits struct {
	Credulity   Level      `json:"credulity"`   // how easily a message raises belief
	Broadcast   Level      `json:"broadcast"`   // how often they post rather than tell/ignore
	Reactivity  Level      `json:"reactivity"`  // 1- or 2-step belief jumps; fear in retelling
	Sociability Level      `json:"sociability"` // graph degree only; not in the prompt
	Distortion  Distortion `json:"distortion"`
	Motive      Motive     `json:"motive"`
}

// Valid reports whether every trait word is known.
func (t Traits) Valid() bool {
	return t.Credulity.Valid() && t.Broadcast.Valid() && t.Reactivity.Valid() &&
		t.Sociability.Valid() && t.Distortion.Valid() && t.Motive.Valid()
}

// trait names one ordinal trait, for jitter and the fixed set.
type trait int

const (
	credulity trait = iota
	broadcast
	reactivity
	sociability
)

func (t *Traits) level(tr trait) *Level {
	switch tr {
	case credulity:
		return &t.Credulity
	case broadcast:
		return &t.Broadcast
	case reactivity:
		return &t.Reactivity
	default:
		return &t.Sociability
	}
}

type archetypeSpec struct {
	archetype Archetype
	share     int // residents per 100
	traits    Traits
	// fixed traits define the archetype and are never jittered, so every
	// resident still reads as their archetype.
	fixed []trait
}

// archetypes: Regular is the largest group on purpose; real spreading is
// concentrated in a small minority (Grinberg et al. 2019).
var archetypes = []archetypeSpec{
	{Regular, 35, Traits{Mid, Mid, Mid, Mid, Leveling, Inform}, nil},
	{Connector, 15, Traits{Mid, Low, Mid, High, Assimilation, Inform}, []trait{sociability}},
	{Worrier, 15, Traits{High, Low, High, Mid, Sharpening, Warn}, []trait{reactivity}},
	{Skeptic, 15, Traits{Low, Mid, Low, Mid, Leveling, Inform}, []trait{credulity}},
	// Credulity comes from the variant, see variantCredulity.
	{CloutChaser, 10, Traits{Mid, High, Mid, Mid, Sharpening, Clout}, []trait{broadcast, credulity}},
	{Hermit, 10, Traits{Mid, Low, Low, Low, Leveling, Inform}, []trait{sociability}},
}

var variantCredulity = map[Variant]Level{TrueBeliever: High, Cynic: Low}

func archetypeByName(a Archetype) (archetypeSpec, bool) {
	for _, s := range archetypes {
		if s.archetype == a {
			return s, true
		}
	}
	return archetypeSpec{}, false
}

// ageShares are roughly US adult proportions, per 100.
var ageShares = []struct {
	age   AgeGroup
	share int
}{
	{Young, 20},
	{Adult, 33},
	{Middle, 25},
	{Senior, 22},
}
