# History

A log of how the design got where it is: which AI suggestions were rejected, overridden or corrected, which errors were caught, and the human decisions that set the direction. Newest session last.

"AI" here means the coding assistant (Claude) used in design and coding sessions, not the LLM residents inside the sim.

Each entry records what the AI proposed, what was decided, and why. Where no reason was given at the time, the entry says so instead of inventing one.

## Before 15 Nov 2026 (from the repo and earlier sessions)

Earlier sessions weren't logged as they happened. These items are reconstructed from commits and saved notes, so they're less detailed.

| What the AI did or proposed | Decision | Why |
|---|---|---|
| Added AI attribution trailers (`Co-Authored-By: Claude`) to commits by default | **Rejected.** Commits are authored by Nicholas Chan only, with no AI trailers (commit `56aa7bc`, CLAUDE.md working agreements) | The author owns the work |
| Treated "Hype Train" as the product name | **Overridden.** The name is a placeholder and stays out of the visible UI | Not decided yet |
| Wrote implementation plans that mixed in course deliverables | **Overridden.** `docs/PLAN.md` covers coding only, and every design choice is a draft until the design review | "None of this is set in stone… your plan should only care about the actual coding and implementation part." |
| Built vegetable residents (`?veggies` page, commits `b77a102`, `b052473`) | **Rejected on 15 Nov** (see below). The residents are abstract shapes | See below |

## 15 Nov 2026: blob design session

### Starting point
The sim had **6 archetypes** (Regular, Connector, Worrier, Skeptic, Clout-chaser, Hermit), each with a body shape, plus **6 trait levels** (credulity, broadcast, reactivity, sociability, distortion, motive), age groups, and a Cynic / True Believer split (`internal/sim/persona.go`). Nicholas started a human-written `BLOBS.md` to standardise blob properties, beginning with `id, name, age, occupation, personality, traits`.

### Decisions

1. **Occupation.** Nicholas asked whether occupation should affect belief. The AI said it shouldn't affect general credulity, since expertise only helps within its own field, and proposed keeping it as descriptive prompt and UI text only. **Decision: occupation dropped** from the property list. *(No reason recorded.)*

2. **Age.** The AI recommended keeping the existing Pew age brackets instead of an exact age. **Rejected:** blobs get an exact age, which is grouped later. *Why:* "age is fine for personality. We will group the ages appropriately anyways later on."

3. **Personality model (human idea).** Nicholas proposed merging personality and traits into three tag lists, with most blobs holding 2 tags (1–3 possible), replacing the 6 archetypes. The AI agreed and added refinements: a low and a high tag per list, and a missing tag meaning average.

4. **The "fickleness" category.** The AI pointed out that "fickle" means changing your mind, not getting outraged, and argued for keeping an emotion/excitability trait because fear is the strongest driver of spread in the research. Nicholas asked how outrage would change the sim at all. **Outcome: excitability was dropped.** Nicholas replaced it with **Persuasiveness** (how believable a blob is to others). The AI noted the research cost of losing emotion; it remains a design-review question.

5. **Category names: four AI proposals rejected.**
   - *Mouth / Ears / Nerves*: rejected, wanted "more fancy".
   - *Loquacity / Credulity / Volatility*: rejected, too fancy, wanted "in the middle… easy to understand but practical".
   - *Chattiness / Gullibility / Excitability*: rejected, wanted "real words that you would use to describe a person".
   - *Talkative / Trusting / Emotional* (tags `reserved/gossipy`, `skeptical/gullible`, `composed/dramatic`): not adopted.
   - **Final (Nicholas's choice): Credulity, Socialness, Persuasiveness**, plus special traits Family-oriented, Recluse and Leader. "Credulity" was kept from the AI's research vocabulary; the other two are Nicholas's.

6. **Vegetables.** With the archetypes gone, the AI proposed mapping the 6 tags onto the 6 existing vegetable bodies using puns (gullible → corn, "all ears"). **Rejected:** "I don't want them to be vegetables… They will be the shapes we had before."

7. **Shapes from tags.** The AI proposed each shape stand for the blob's main tag (composed → cube, dramatic → star, …), with the other tags shown as accessories or details borrowed from other shapes. **Rejected:** "That's a bit much."

8. **Shapes as cultures (human idea).** Nicholas proposed that shapes stand for cultures, where some shapes trust their own kind more and others trust everyone, and that sizes show families. The AI agreed. It recommended making group openness a per-run setting rather than fixed to a shape, to avoid stereotyping, and calling the groups neighbourhoods. **Partly overridden:** `BLOBS.md` gives each shape a fixed trust behaviour (Square trusts squares, Circle trusts everyone, Star trusts no one, Capsule trusts family). Still open for the design review.

9. **Research review of `BLOBS.md`.** The AI flagged where the draft conflicts with research: "elders believe no one" is backwards (older adults share more fake news and trust more), families sharing identical tags doesn't fit (personality is about 40% heritable), "at least 2 adults" rules out single parents, the Credulity definition is inverted, and Circle and Star duplicate credulity. **Pending:** not yet applied to `BLOBS.md`.

10. **Citation check: AI errors caught.** Nicholas asked for a source behind every claim. The AI checked six of them with web searches and found three of its own errors:
    - It had said **"nearly a quarter of US households with children"** are single-parent. Pew's figure is **23% of US children**.
    - It had said older adults rate **strangers** as more trustworthy. Castle et al. (2012) is specifically about **untrustworthy-looking faces**.
    - It had linked recluses to social media use. The loneliness–conspiracy study (Bierwiaczonek et al. 2024) says nothing about social media. That was the AI's assumption.
    
    Claims from memory were marked as unchecked, and the AI listed separately which of its claims were its own opinions with no research behind them. *Lesson:* AI-supplied citations need checking before they go into any doc.

11. **Meters.** Nicholas proposed meters such as fear or happiness. The AI advised against fear (the belief word already measures it) and happiness (too vague), and suggested trust between blobs, self-fulfilling actions (panic buying, bank runs), scapegoating, and crying wolf. **Adopted: trust between blobs.** Nicholas questioned panic buying ("would this need an economy?") and pointed out that broken trust between pairs of blobs doesn't show **town-wide** distrust.

12. **Player as a news station (human idea).** Nicholas proposed a player-run news station. The AI added an outlet trust meter and a final true-story score. Nicholas then proposed 10 stages of AI-related topics where the player builds a story from fixed headline and image choices, to avoid paying for model calls on every choice. The AI warned that choosing headlines and images is close to *We Become What We Behold*'s core loop, and that a player breaks hard rule 4 (UI only replays). **Dropped by Nicholas:** "So maybe not a media."

13. **Player as an AI/tech company (human idea, current direction).** You run a tech company announcing new features. The goal is to keep **trust high** while the **stock price rises**. The AI added the claim-vs-reality gap: you announce, the feature ships later, and users compare it with what they *heard* after the story spread and distorted. It also suggested a rival company and keeping all companies fictional.

14. **Educational framing.** The project has to be educational. The AI framed it as an *explorable explanation* with three learning goals (the claim–reality gap, losing control of your story as it spreads, burned audiences doubting true claims). It also proposed cutting scope: 5 stages instead of 10, stub brain live, LLM retellings generated offline and reviewed. **Pending** design review.

### Where the design stands
A town of shape-coded blobs (shape = community, size = age and family, face = belief) with exact ages and three tag categories (Credulity, Socialness, Persuasiveness), plus Family-oriented, Recluse and Leader. Trust lives between blobs. The player runs a fictional tech company and announces features; hype lifts the stock now and costs trust once reality ships. Hard rules 3 and 4 need revisiting for a live, player-driven mode.

## Adding entries

Add an entry in the same change whenever an AI suggestion is rejected, overridden or corrected, an AI error is caught, or a human decision changes direction. Use: what the AI proposed → decision → why (quote the reason if one was given; otherwise write *no reason recorded*). Don't reword history to look smoother than it was.
