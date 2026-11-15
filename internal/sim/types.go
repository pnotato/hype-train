package sim

// Belief is how alarmed an agent is about the seed story. It is a word, not a
// number, so the UI and prompts never imply false precision.
type Belief string

// Belief values, from least to most alarmed.
const (
	Calm     Belief = "calm"
	Unsure   Belief = "unsure"
	Worried  Belief = "worried"
	Panicked Belief = "panicked"
)

// Valid reports whether b is a known belief word.
func (b Belief) Valid() bool {
	switch b {
	case Calm, Unsure, Worried, Panicked:
		return true
	}
	return false
}

// AgentKind separates residents (people) from outlets (media sources).
type AgentKind string

// Agent kinds.
const (
	KindResident AgentKind = "resident"
	KindOutlet   AgentKind = "outlet"
)

// Valid reports whether k is a known agent kind.
func (k AgentKind) Valid() bool {
	return k == KindResident || k == KindOutlet
}

// Outlet IDs that residents can follow.
const (
	OutletPaper     = "outlet-paper"
	OutletClickbait = "outlet-clickbait"
)

// AgentProfile is the fixed description of one agent for a run. Persona fields
// are set only for residents.
type AgentProfile struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Kind        AgentKind `json:"kind"`
	AgeGroup    AgeGroup  `json:"ageGroup,omitempty"`
	Archetype   Archetype `json:"archetype,omitempty"`
	Variant     Variant   `json:"variant,omitempty"`
	Traits      *Traits   `json:"traits,omitempty"`
	Follows     []string  `json:"follows,omitempty"`
	Neighbors   []string  `json:"neighbors,omitempty"`
	StartBelief Belief    `json:"startBelief"`
}
