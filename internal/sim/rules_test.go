package sim

import (
	"math"
	"math/rand/v2"
	"testing"
)

// Tests for the per-blob rules in game.go. They check the direction of each
// rule (who trusts whom more), not the exact (design) numbers, so tuning the
// constants shouldn't break them.

func blob(shape Shape, age int, traits ...Trait) *Blob {
	return &Blob{Shape: shape, Age: age, Traits: traits}
}

func TestCredulity(t *testing.T) {
	sk, avg, gu := credulity(blob(Circle, 30, Skeptic)), credulity(blob(Circle, 30)), credulity(blob(Circle, 30, Gullible))
	if !(sk < avg && avg < gu) || avg != 1 {
		t.Errorf("credulity skeptic %v, average %v, gullible %v", sk, avg, gu)
	}
}

func TestPersuasiveness(t *testing.T) {
	un, avg, ch := persuasiveness(blob(Circle, 30, Unconvincing)), persuasiveness(blob(Circle, 30)), persuasiveness(blob(Circle, 30, Charismatic))
	if !(un < avg && avg < ch) || avg != 1 {
		t.Errorf("persuasiveness unconvincing %v, average %v, charismatic %v", un, avg, ch)
	}
}

func TestShareChance(t *testing.T) {
	quiet, avg, chatty := blob(Circle, 30, Quiet), blob(Circle, 30), blob(Circle, 30, Chatty)
	for _, i := range []int{0, 20, 50, 100} {
		q, a, c := shareChance(quiet, 50, i), shareChance(avg, 50, i), shareChance(chatty, 50, i)
		if !(q < a && a < c) {
			t.Errorf("interest %d: quiet %v, average %v, chatty %v", i, q, a, c)
		}
	}
	for _, b := range []*Blob{quiet, avg, chatty} {
		if shareChance(b, 50, 80) <= shareChance(b, 50, 20) {
			t.Errorf("%v: more interest should mean more sharing", b.Traits)
		}
		// Strong feelings either way raise sharing equally.
		if shareChance(b, 90, 20) <= shareChance(b, 50, 20) || shareChance(b, 10, 20) != shareChance(b, 90, 20) {
			t.Errorf("%v: extreme perception should raise sharing symmetrically", b.Traits)
		}
		for p := 0; p <= 100; p += 10 {
			for i := 0; i <= 100; i += 10 {
				if c := shareChance(b, p, i); c < 0 || c > 0.95 {
					t.Fatalf("%v p=%d i=%d: chance %v out of [0, 0.95]", b.Traits, p, i, c)
				}
			}
		}
	}
}

func TestPostChance(t *testing.T) {
	if postChance(blob(Circle, 30, Chatty)) <= postChance(blob(Circle, 30)) {
		t.Error("chatty blobs should post more")
	}
}

func TestTrust(t *testing.T) {
	near, far := Hex{0, 0}, Hex{5, 0}
	with := func(b *Blob, fam int, home Hex) *Blob { b.Family, b.Home = fam, home; return b }
	tests := []struct {
		name                 string
		l, trusted, stranger *Blob
	}{
		{"square trusts squares", blob(Square, 30), blob(Square, 30), blob(Circle, 30)},
		{"triangle trusts its age", blob(Triangle, 30), blob(Circle, 38), blob(Circle, 60)},
		{"star trusts its leader", blob(Star, 30), blob(Star, 40, Leader), blob(Star, 40)},
		{"tear trusts neighbours", with(blob(Tear, 30), 0, near), with(blob(Circle, 30), 0, Hex{1, 1}), with(blob(Circle, 30), 0, far)},
		{"capsule trusts family", with(blob(Capsule, 30), 1, near), with(blob(Capsule, 50), 1, near), with(blob(Capsule, 50), 2, near)},
		{"child trusts own parent", with(blob(Circle, 10, Child), 1, near), with(blob(Circle, 40, Parent), 1, near), with(blob(Circle, 40, Parent), 2, near)},
	}
	for _, tt := range tests {
		if a, b := trust(tt.l, tt.trusted), trust(tt.l, tt.stranger); a <= b {
			t.Errorf("%s: trusted %v, stranger %v", tt.name, a, b)
		}
	}

	// Circles trust everyone the same.
	c := blob(Circle, 30)
	if trust(c, blob(Square, 30)) != trust(c, blob(Circle, 80, Leader)) {
		t.Error("circle trust depends on the speaker")
	}
	// Elders trust more.
	if trust(blob(Circle, 70), c) <= trust(blob(Circle, 40), c) {
		t.Error("elders should trust more")
	}
	// Family 0 means no family, not a shared one.
	if trust(with(blob(Capsule, 30), 0, near), with(blob(Capsule, 30), 0, near)) != 1 {
		t.Error("two blobs without a family were treated as family")
	}
}

func TestReach(t *testing.T) {
	at := func(q int, fam int, traits ...Trait) *Blob {
		b := blob(Circle, 30, traits...)
		b.Home, b.Family = Hex{q, 0}, fam
		return b
	}
	talker := at(0, 1)
	if reach(talker, at(1, 0)) <= reach(talker, at(4, 0)) {
		t.Error("nearer listeners should be picked more")
	}
	if reach(talker, at(3, 1)) <= reach(talker, at(3, 2)) {
		t.Error("family should be picked more than a non-family blob just as far")
	}
	if reach(talker, at(2, 0, Chatty)) <= reach(talker, at(2, 0)) || reach(talker, at(2, 0)) <= reach(talker, at(2, 0, Quiet)) {
		t.Error("sociable listeners should be picked more")
	}
	if reach(at(0, 0), at(3, 0)) != reach(at(0, 0), at(3, 0)) || reach(at(0, 0), at(0, 0)) <= 0 {
		t.Error("reach should be positive and stable")
	}
}

func TestNudge(t *testing.T) {
	g := &Game{rng: rand.New(rand.NewPCG(1, 0))}
	tests := []struct {
		v    int
		d    float64
		want int
	}{
		{50, 0, 50}, {50, 7, 57}, {50, -7, 43},
		{95, 20, 100}, {5, -20, 0}, {100, 1, 100}, {0, -1, 0},
	}
	for _, tt := range tests {
		if got := g.nudge(tt.v, tt.d); got != tt.want {
			t.Errorf("nudge(%d, %v) = %d, want %d", tt.v, tt.d, got, tt.want)
		}
	}
	// A fractional pull adds up to itself on average.
	for _, d := range []float64{0.3, -0.3, 2.75} {
		sum := 0
		const n = 20000
		for range n {
			got := g.nudge(50, d)
			if got != 50+int(math.Floor(d)) && got != 50+int(math.Ceil(d)) {
				t.Fatalf("nudge(50, %v) = %d", d, got)
			}
			sum += got - 50
		}
		if avg := float64(sum) / n; math.Abs(avg-d) > 0.03 {
			t.Errorf("nudge by %v averages %v", d, avg)
		}
	}
}
