package sim

import (
	"errors"
	"fmt"
	"math"
	"math/rand/v2"
	"slices"
)

// LogVersion is bumped whenever the RunLog shape changes.
const LogVersion = 2

// Round-loop numbers. All (design) drafts; docs/BLOBS.md has the reasoning
// each one stands for.
const (
	influence    = 0.12 // base pull of one exposure towards the speaker's view
	maxInfluence = 0.6  // cap on that pull, however trusted the speaker
	repeatWeight = 0.5  // same speaker again since the last story [24]
	lossWeight   = 1.5  // bad news lands harder than good [31]
	exposureBump = 2.0  // interest from hearing about the company at all [23]
	interestFade = 0.06 // share of interest every blob loses each round
	storyReach   = 0.30 // chance a blob sees the company's story first-hand
	postReach    = 3    // readers of an ordinary post
	underPosting = 13   // younger blobs read but don't post
)

// Config fixes a run. The same Config and the same story choices always give
// the same RunLog.
type Config struct {
	Blobs      int    `json:"blobs"`
	Rounds     int    `json:"rounds"`
	StoryEvery int    `json:"storyEvery"` // rounds between the player's stories
	Seed       uint64 `json:"seed"`
}

// DefaultConfig is the design-doc game: ~100 blobs, 50 rounds, a story every 10.
func DefaultConfig(seed uint64) Config {
	return Config{Blobs: 100, Rounds: 50, StoryEvery: 10, Seed: seed}
}

// Story is a news story the player can publish. Perception and Interest are
// the push it gives each blob who sees it first-hand.
type Story struct {
	ID         string `json:"id"`
	Headline   string `json:"headline"`
	Perception int    `json:"perception"`
	Interest   int    `json:"interest"`
}

// TODO(design): placeholder options until the product reality model and the
// player's choices are decided (docs/agents/PLAN.md §2, items 1–2). Without a
// reality check, bold claims have no downside yet.
var stories = []Story{
	{"bold", "Our assistant will do your taxes, your emails and your job by spring", 15, 30},
	{"modest", "New assistant update writes better email drafts", 8, 12},
	{"honest", "Assistant update: faster, still makes mistakes, here's where", 4, 5},
}

// EventKind is what happened in an event.
type EventKind string

// Event kinds. Idle blobs produce no event.
const (
	KindStory EventKind = "story" // the company publishes the player's story
	KindTalk  EventKind = "talk"  // one blob talks to another in person
	KindPost  EventKind = "post"  // one blob posts; To are the readers
)

// Company is the From of a story event.
const Company = -1

// Event is one thing that happened in a round, with its effect on every blob
// it reached.
type Event struct {
	ID      string    `json:"id"` // "r12-e3"
	Kind    EventKind `json:"kind"`
	From    int       `json:"from"` // blob ID, or Company
	To      []int     `json:"to"`
	Story   string    `json:"story,omitempty"` // Story.ID, for story events
	Effects []Effect  `json:"effects"`
}

// Effect is a blob's scores right after an event reached it.
type Effect struct {
	Blob       int `json:"blob"`
	Perception int `json:"perception"`
	Interest   int `json:"interest"`
}

// Round is one round's events and every blob's scores at its end, indexed by
// blob ID.
type Round struct {
	Index         int     `json:"index"` // 1-based
	Events        []Event `json:"events"`
	Perception    []int   `json:"perception"`
	Interest      []int   `json:"interest"`
	AvgPerception float64 `json:"avgPerception"`
	AvgInterest   float64 `json:"avgInterest"`
}

// Choice records the story the player picked before a round.
type Choice struct {
	Round int    `json:"round"`
	Story string `json:"story"`
}

// RunLog is the whole run: the contract between Go and the client.
type RunLog struct {
	Version int      `json:"version"`
	Config  Config   `json:"config"`
	Blobs   []Blob   `json:"blobs"`
	Stories []Story  `json:"stories"` // every story published, in order
	Choices []Choice `json:"choices"`
	Rounds  []Round  `json:"rounds"`
}

// Game is a run in progress. It is not safe for concurrent use.
type Game struct {
	log   RunLog
	rng   *rand.Rand
	p, i  []int    // current scores by blob ID
	heard [][]bool // heard[l][s]: l heard s since the last story
}

// NewGame builds the town and waits for the first story.
func NewGame(cfg Config) (*Game, error) {
	if cfg.Rounds < 1 || cfg.StoryEvery < 1 {
		return nil, errors.New("rounds and storyEvery must be positive")
	}
	rng := rand.New(rand.NewPCG(cfg.Seed, 0x6b7970))
	blobs, err := BuildTown(rng, cfg.Blobs)
	if err != nil {
		return nil, err
	}
	g := &Game{
		log:   RunLog{Version: LogVersion, Config: cfg, Blobs: blobs},
		rng:   rng,
		p:     make([]int, len(blobs)),
		i:     make([]int, len(blobs)),
		heard: make([][]bool, len(blobs)),
	}
	for k, b := range blobs {
		g.p[k], g.i[k] = b.Perception, b.Interest
		g.heard[k] = make([]bool, len(blobs))
	}
	return g, nil
}

// Replay rebuilds a game from its config and the player's choices.
func Replay(cfg Config, choices []string) (*Game, error) {
	g, err := NewGame(cfg)
	if err != nil {
		return nil, err
	}
	for _, c := range choices {
		if _, err := g.Choose(c); err != nil {
			return nil, err
		}
	}
	return g, nil
}

// Log is the run so far. Callers must not modify it.
func (g *Game) Log() *RunLog { return &g.log }

// Done reports whether every round has been played.
func (g *Game) Done() bool { return len(g.log.Rounds) >= g.log.Config.Rounds }

// Options are the stories the player can pick next, or nil when done.
func (g *Game) Options() []Story {
	if g.Done() {
		return nil
	}
	return slices.Clone(stories)
}

// Choose publishes a story and plays rounds up to the next choice.
func (g *Game) Choose(storyID string) ([]Round, error) {
	if g.Done() {
		return nil, errors.New("run is finished")
	}
	i := slices.IndexFunc(stories, func(s Story) bool { return s.ID == storyID })
	if i < 0 {
		return nil, fmt.Errorf("unknown story %q", storyID)
	}
	s := stories[i]
	first := len(g.log.Rounds)
	g.log.Stories = append(g.log.Stories, s)
	g.log.Choices = append(g.log.Choices, Choice{Round: first + 1, Story: s.ID})
	for k := 0; k < g.log.Config.StoryEvery && !g.Done(); k++ {
		var st *Story
		if k == 0 {
			st = &s
		}
		g.log.Rounds = append(g.log.Rounds, g.playRound(st))
	}
	return g.log.Rounds[first:], nil
}

// playRound runs one round: the story (if any) lands, then blobs decide to
// share or idle, talkers pick listeners, posters reach readers, and everyone
// interest fades a little. Speakers pass on their view from
// the start of the round, so event order doesn't change what they say.
func (g *Game) playRound(story *Story) Round {
	blobs := g.log.Blobs
	n := len(blobs)
	r := Round{Index: len(g.log.Rounds) + 1}
	add := func(e Event) {
		e.ID = fmt.Sprintf("r%d-e%d", r.Index, len(r.Events)+1)
		r.Events = append(r.Events, e)
	}

	if story != nil {
		for _, h := range g.heard {
			clear(h)
		}
		e := Event{Kind: KindStory, From: Company, Story: story.ID}
		for k := range blobs {
			b := &blobs[k]
			chance := storyReach
			if b.Has(Recluse) {
				chance *= 2 // social media is all they have
			}
			if !b.Has(Leader) && g.rng.Float64() >= chance {
				continue
			}
			g.p[k] = g.nudge(g.p[k], float64(story.Perception)*credulity(b))
			g.i[k] = g.nudge(g.i[k], float64(story.Interest))
			e.To = append(e.To, k)
			e.Effects = append(e.Effects, Effect{k, g.p[k], g.i[k]})
		}
		add(e)
	}

	startP, startI := slices.Clone(g.p), slices.Clone(g.i)
	hear := func(l, s int) Effect {
		lb, sb := &blobs[l], &blobs[s]
		w := influence * credulity(lb) * persuasiveness(sb) * trust(lb, sb)
		if g.heard[l][s] {
			w *= repeatWeight
		}
		if startP[s] < g.p[l] {
			w *= lossWeight
		}
		w = min(w, maxInfluence)
		g.heard[l][s] = true
		g.p[l] = g.nudge(g.p[l], w*float64(startP[s]-g.p[l]))
		g.i[l] = g.nudge(g.i[l], w*float64(max(0, startI[s]-g.i[l]))+exposureBump)
		return Effect{l, g.p[l], g.i[l]}
	}

	// Who shares this round, and how. Talkers are chosen before listeners.
	var talkers, posters []int
	for _, k := range g.rng.Perm(n) {
		b := &blobs[k]
		if g.rng.Float64() >= shareChance(b, startP[k], startI[k]) {
			continue
		}
		canPost := b.Age >= underPosting
		switch {
		case b.Has(Recluse):
			if canPost {
				posters = append(posters, k)
			}
		case canPost && g.rng.Float64() < postChance(b):
			posters = append(posters, k)
		default:
			talkers = append(talkers, k)
		}
	}

	// Each talker picks one free listener, preferring family, people nearby
	// and sociable blobs. Nobody is in two conversations in a round.
	busy := make([]bool, n)
	for _, t := range talkers {
		busy[t] = true
	}
	for _, t := range talkers {
		var cands []weighted[int]
		for k := range blobs {
			if busy[k] || blobs[k].Has(Recluse) {
				continue
			}
			cands = append(cands, weighted[int]{k, reach(&blobs[t], &blobs[k])})
		}
		if len(cands) == 0 {
			continue // nobody free: the talker idles
		}
		l := pick(g.rng, cands)
		busy[l] = true
		add(Event{Kind: KindTalk, From: t, To: []int{l}, Effects: []Effect{hear(l, t)}})
	}

	for _, s := range posters {
		e := Event{Kind: KindPost, From: s}
		for _, l := range g.readers(s) {
			e.To = append(e.To, l)
			e.Effects = append(e.Effects, hear(l, s))
		}
		add(e)
	}

	// Interest fades, faster the higher it is, so news has to keep coming.
	pSum, iSum := 0, 0
	for k := range blobs {
		g.i[k] = g.nudge(g.i[k], -interestFade*float64(g.i[k]))
		pSum += g.p[k]
		iSum += g.i[k]
	}
	r.Perception, r.Interest = slices.Clone(g.p), slices.Clone(g.i)
	r.AvgPerception = math.Round(float64(pSum)/float64(n)*10) / 10
	r.AvgInterest = math.Round(float64(iSum)/float64(n)*10) / 10
	return r
}

// readers of a post. A leader reaches everyone of their shape; anyone else
// reaches a few blobs, more if they're charismatic or chatty. Recluses read
// more than most.
func (g *Game) readers(s int) []int {
	blobs := g.log.Blobs
	sb := &blobs[s]
	var out []int
	if sb.Has(Leader) {
		for k, b := range blobs {
			if k != s && b.Shape == sb.Shape {
				out = append(out, k)
			}
		}
		return out
	}
	k := postReach
	if sb.Has(Charismatic) {
		k += 3
	}
	if sb.Has(Chatty) {
		k += 3
	}
	var cands []weighted[int]
	for j := range blobs {
		if j == s {
			continue
		}
		w := 1.0
		if blobs[j].Has(Recluse) {
			w = 2
		}
		cands = append(cands, weighted[int]{j, w})
	}
	for range min(k, len(cands)) {
		j := pick(g.rng, cands)
		out = append(out, j)
		cands = slices.DeleteFunc(cands, func(c weighted[int]) bool { return c.v == j })
	}
	slices.Sort(out)
	return out
}

// nudge adds d to v, rounding up with probability equal to d's fraction so
// small pulls still add up over many rounds, and clamps to 0–100.
func (g *Game) nudge(v int, d float64) int {
	f := math.Floor(d)
	if g.rng.Float64() < d-f {
		f++
	}
	return min(100, max(0, v+int(f)))
}

// shareChance: socialness and interest decide sharing, not perception [1],
// [2]; blobs with strong feelings either way talk more [30].
func shareChance(b *Blob, p, i int) float64 {
	base := 0.35
	switch {
	case b.Has(Quiet):
		base = 0.15
	case b.Has(Chatty):
		base = 0.75
	}
	extreme := math.Abs(float64(p)-50) / 50
	return min(0.95, base*(0.3+float64(i)/100)+0.25*extreme)
}

// postChance is how often a sharer posts instead of talking.
func postChance(b *Blob) float64 {
	if b.Has(Chatty) {
		return 0.5
	}
	return 0.25
}

func credulity(b *Blob) float64 {
	switch {
	case b.Has(Skeptic):
		return 0.5
	case b.Has(Gullible):
		return 1.6
	}
	return 1
}

func persuasiveness(b *Blob) float64 {
	switch {
	case b.Has(Unconvincing):
		return 0.6
	case b.Has(Charismatic):
		return 1.5
	}
	return 1
}

// trust is how much listener l trusts speaker s, from l's shape (BLOBS.md
// "Shape"), family, and age: elders trust more [6].
func trust(l, s *Blob) float64 {
	t := 1.0
	family := l.Family != 0 && l.Family == s.Family
	if family && l.Has(Child) && s.Has(Parent) {
		t *= 3 // [4], [5]
	}
	switch l.Shape {
	case Square:
		if s.Shape == Square {
			t *= 2
		}
	case Triangle:
		if abs(l.Age-s.Age) <= 10 {
			t *= 2
		}
	case Star:
		if s.Shape == Star && s.Has(Leader) {
			t *= 3
		}
	case Tear:
		if l.Home.Dist(s.Home) <= 2 {
			t *= 2
		}
	case Capsule:
		if family {
			t *= 2
		}
	}
	if l.Age >= 65 {
		t *= 1.2
	}
	return t
}

// reach is how likely talker t is to pick listener l: family first, then
// people close to home, then anyone; sociable listeners get picked more.
func reach(t, l *Blob) float64 {
	w := 1 / float64(1+t.Home.Dist(l.Home))
	if t.Family != 0 && t.Family == l.Family {
		w *= 4
	}
	switch {
	case l.Has(Quiet):
		w *= 0.5
	case l.Has(Chatty):
		w *= 1.5
	}
	return w
}
