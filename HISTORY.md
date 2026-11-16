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

15. **Real-world hype examples: AI error caught.** In entry 13's discussion the AI had said, from memory, that Long Island Iced Tea's stock jumped "about 200% in a day" after renaming itself Long Blockchain. When it checked while compiling real hype examples, the reported figure turned out to be **about 289% at close, up to about 380% intraday**. The SEC's later case (2021) was about insider trading around the announcement, not the hype itself. The AI also nearly linked IBM Watson's halted MD Anderson project ($62M, 2017) to IBM's 2022 sale of Watson Health; the search showed they were separate events. *Lesson:* verify before stating, even for "well-known" examples.

16. **Doc review (evening).** Nicholas rewrote `docs/PLAN.md` as a short human doc and added `docs/GAME LOOP.md`, moving `BLOBS.md` into `docs/`. The AI flagged that the rewrite had dropped the old plan's research evidence and milestones, and that "100 small LLMs" running live is about 5,000 calls per playthrough: too slow locally, and pregenerating the text is cheaper. **Decisions (Nicholas):** perception and interest are **scores out of 100**; **no winning or losing**, but the player wants both high near the end. This overrides the old hard rule 5 ("belief is a word, not a number"), which `CLAUDE.md` now reflects. The old plan was restored for agents as `docs/agents/PLAN.md`. The AI's recommendation to pregenerate LLM text is still open.

17. **Research list with IEEE references.** The AI wrote `docs/RESEARCH.md` and checked 24 of its 41 references online. Errors caught or limits found while checking:
    - The Traberg & van der Linden paper's authors couldn't be confirmed online (title, journal and DOI could).
    - No published under-18 share for Canada turned up. The ~20% is an estimate.
    - The 2023 *Scientific Reports* narcissism study from the old plan was dropped because its authors couldn't be confirmed.
    
    Unchecked references are marked.

18. **BLOBS.md edits (asked for, kept short).** The AI fixed the JSON, made age a number, replaced `doomscroller` (no category) with `recluse`, removed the blank `occupation`, and un-inverted the Credulity definition ("Lower means more likely to believe" → "Higher"). It changed "Elder blobs are less likely to believe anyone" to match the research, removed a sentence fragment ("Children "), changed families from "1 other adult" to "1 adult" (single parents), changed "families share exact tags" to "share a shape; tags rolled per blob", changed Leader's persuasiveness from 5 to max (there are 3 levels), and added the 0–100 scores. **Left alone:** Triangle and Tear rules, the unsupported "adults believe elders" line, and trait adjective names. Those are Nicholas's calls.

19. **BLOBS.md becomes the master blob doc (asked for; reworking interactions allowed).** The AI rewrote it with IEEE citations and its own reference list. Every rule is either cited or marked *(design)*. Changes to Nicholas's rules, so they're easy to revert:
    - **Star:** "less likely to trust everybody" → trusts its shape's Leader most. The old rule duplicated low credulity.
    - **Triangle and Tear filled in:** trusts own age, and trusts neighbours. Both are homophily bases.
    - **Leader:** "only 1, changes every few rounds" → 1 per shape, stable. Research says opinion leaders are local and several.
    - **Dropped:** "adults more likely to believe elders" (no evidence found).
    - **Added (marked design):** tag names (`skeptic/gullible`, `quiet/chatty`, `unconvincing/charismatic`), age groups with Canadian shares, starting scores (perception 50, interest 20), no social media for children, and the rule that shape sets *who* a blob trusts and credulity sets *how much*.

20. **Children and social media: AI design note corrected.** The AI had written "children: no social media" into `BLOBS.md` as a design choice. Nicholas questioned it ("wouldn't it be like they can read but can't post?"). A check showed teens use social media heavily, and many under-13s use it despite platform age rules. **Now:** under 13 read only *(design)*; 13–17 read and post. Posting is rare at every age, which rare `chatty` blobs already cover.

### Where the design stands
A town of about 100 Canadian-representative blobs (shape = culture, size = age and family) with exact ages and three trait categories (Credulity, Socialness, Persuasiveness), plus Family-oriented, Recluse and Leader. Each blob has perception and interest scores (0–100). The player runs a fictional AI company's newsroom and picks a news story every 10 of 50 rounds; bold claims raise interest now and cost perception if the product underdelivers. No win or lose. Open: the product reality model, the player's choices, the LLM's role, and hard rule 4 for a live mode (see `docs/agents/PLAN.md` §2).

## Adding entries

Add an entry in the same change whenever an AI suggestion is rejected, overridden or corrected, an AI error is caught, or a human decision changes direction. Use: what the AI proposed → decision → why (quote the reason if one was given; otherwise write *no reason recorded*). Don't reword history to look smoother than it was.
