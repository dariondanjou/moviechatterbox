# MovieChatterbox — Functional Requirements Document

**Version:** 1.3 | **Date:** July 3, 2026
**Owner:** Darion D'Anjou, Founder/Operator — a Darion D'Anjou project
**Status:** Approved decisions from monetization & architecture planning session, plus existing-site audit, competitor feature absorption, Chatterbox naming, AI personalization, data-use policy, and future-state vision (§8–13)

---

## 1. Product Overview

### 1.1 Vision
MovieChatterbox is the place where lovers of TV and film talk to each other — live. It fuses three proven models into one platform:

- **Clubhouse layer ("Chatterboxes"):** live social audio rooms where users open conversations about any movie, show, episode, person, or list on the platform.
- **IMDb layer (Database):** a robust film/TV information database so talkers can reference facts, cast, episodes, and credits mid-conversation.
- **Letterboxd layer (Profiles & Lists):** personalized profile pages built around user-curated lists. Every content item on any list is a tap away from starting or joining a conversation about it.

### 1.2 Operating Constraint (governs all requirements)
The company is a **company of one**. Every system in this document must satisfy the **Solo-Operator Principle**:

> No revenue stream, moderation process, payout, or growth mechanic may require ongoing manual sales effort, manual accounting, or human babysitting. If it can't run while the founder sleeps or is on a film set, it doesn't ship.

### 1.3 Strategic Posture
- The **database/profile/list layer is the profit engine** (near-zero serving cost, ad- and subscription-monetized).
- The **audio layer is the differentiator and the cost center** (billed per participant-minute). Product design must always allow the Letterboxd-style layer to succeed standalone.
- Launch focused on a single fandom vertical (recommended: horror) before widening.
- Live audio failure must degrade gracefully to text threads; every content page carries a persistent async discussion thread.

---

## 2. Core Product Pillars

### 2.1 Chatterboxes (Live Audio Rooms)
- FR-2.1.1: Any user may open a Chatterbox attached to any content entity (film, show, season, episode, person, list) or as freeform.
- FR-2.1.2: Chatterboxes support host, co-host(s)/joint creators, speakers, and listeners. Initial room cap: 100 participants (containable moderation surface).
- FR-2.1.3: Scheduled Chatterboxes are first-class objects: creation, discovery calendar, reminders/notifications, and calendar export. Event programming anchors to the release calendar (premieres, finales, awards nights, anniversaries).
- FR-2.1.4: Host-controlled recording (opt-in). Recordings become replayable content pages with their own ad inventory, SEO surface, and clip-export for social marketing.
- FR-2.1.5: If audio infrastructure fails, the Chatterbox page degrades to its live text thread without losing the room state.

### 2.2 Database Layer
- FR-2.2.1: Film/TV metadata sourced from TMDB. **Commercial TMDB license required before monetization switches on** (budget $200–500/mo; confirm current terms directly with TMDB).
- FR-2.2.2: Every entity (title, person, episode, list) has a canonical page: metadata, where-to-watch affiliate links, active/scheduled Chatterboxes, replays, reviews, and a persistent text thread.
- FR-2.2.3: Where-to-watch via JustWatch partnership or direct streaming affiliate programs; ticketing links via Fandango affiliate.

### 2.3 Profiles & Lists
- FR-2.3.1: Profile pages are built around user-curated lists; every list item deep-links to its entity page and its "start a Chatterbox about this" action.
- FR-2.3.2: Reviews, ratings, diary-style logging, follows, and activity feed.
- FR-2.3.3: Premium profile customization (flair, themes, pinned lists) is a paid perk.

### 2.4 Conversational Runner (Signature Feature)
A live, transcript-driven link rail that follows the conversation and surfaces relevant on-platform pages in real time.

- FR-2.4.1: Live speech-to-text runs **once per room** (single transcription stream serves all listeners). Reference cost: ~$0.006/min (~$0.36/hour/room, Deepgram/Whisper-class streaming).
- FR-2.4.2: **Activation threshold: runner turns on at ≥10 listeners.** Below 10, hosts get manual pinning (tap to pin an entity card — zero cost; pin interactions are logged as training data for relevance logic). Threshold framed to creators as a growth incentive.
- FR-2.4.3: Entity matching runs against the platform's own TMDB-backed database (fuzzy matching on titles, names, episode references in transcript).
- FR-2.4.4: Each runner card carries a **decay timer refreshed by topic-shift detection** — a link persists a contextually relevant amount of time and is replaced when conversation moves on, not on a fixed clock.
- FR-2.4.5: **Every 4th runner slot is an ad**, rendered as a native ad card matching runner UI. Contextual relevance preferred (entity mentioned → related promoted content) when demand exists; programmatic native fill otherwise.
- FR-2.4.6: Tapping a runner card opens the entity page (in-app, without leaving the room audio) — deliberately routing listeners into ad-monetized, zero-serving-cost browse surface mid-listen.

---

## 3. Monetization Requirements

### 3.1 Ad System — Placements
| ID | Placement | Format | Trigger | Notes |
|---|---|---|---|---|
| AD-1 | Room entry | 10s video interstitial | Plays during audio connection/handshake (loading-screen pattern) | Masks latency; document as loading-screen ad for app review compliance |
| AD-2 | In-room break | Room-wide ad break | Every ~30 min of room runtime; 5s host warning, then 15–30s spot served to all listeners simultaneously | Ships as video/display interstitial year one; upgrade to true audio demand (AdsWizz/Triton) when scale permits |
| AD-3 | Runner slot | Native card | Every 4th runner link | Lower eCPM ($2–3) but high-intent contextual inventory |
| AD-4 | Browse surface | Banners + native display "everywhere" | All entity pages, lists, profiles, replays, search | Pure margin: no creator share, no audio cost. Primary ad revenue engine |

- FR-3.1.1: No ads for Premium subscribers (all placements suppressed).
- FR-3.1.2: **No cap on free listening time.** Heavy listeners are net-positive under the full ad stack (blended ~$1.65–1.85/mo revenue vs ~$1.19/mo audio cost at 40 min/day) and lurkers are audience inventory that retains creators. Revisit only if the internal margin dashboard (FR-3.6.2) shows a bleeding cohort.

### 3.2 Ad-Request Abstraction Layer (required architecture)
- FR-3.2.1: A single internal ad service owns all placement decisions: *"show ad now, of type X, in context Y, attribute revenue to creator Z."* UI code never calls network SDKs directly.
- FR-3.2.2: The layer routes to interchangeable fill sources — mediation SDK (day 1), managed network (Playwire tier), and direct-sold/promoted campaigns (self-serve sponsorships) — without changes to placement logic or the creator ledger.
- FR-3.2.3: Every impression event is written to the revenue ledger with room ID, creator ID(s), placement type, and eCPM data.

### 3.3 Ad Network Integration Ladder
1. **Day 1:** Google AdMob (mobile) + AdSense (web) — no minimums, self-serve. AppLovin MAX or Unity LevelPlay as mediation from day 1 so later upgrades are additive.
2. **~1,000 DAU / 500K monthly pageviews:** apply to Playwire (entertainment-vertical demand; the partner behind Letterboxd's 490% ad revenue lift). Mediavine main network at $5K annual ad revenue (Journey tier earlier). **Check exclusivity clauses against the mediation stack before signing.**
3. **Scale:** direct audio ad demand (AdsWizz/Triton) for AD-2 slots; direct-sold entertainment campaigns through the abstraction layer.
- FR-3.3.1: Expectation setting is a requirement: first-90-day ad revenue will be minimal while fill rates and eCPMs build history; financial model must not assume mature eCPMs before month 4.

### 3.4 Premium Subscription
- FR-3.4.1: $4.99/month or $49/year. Sold **web-first via Stripe/Paddle checkout** to avoid the 30% app-store cut (post-2025 US rules permit link-out from the app).
- FR-3.4.2: Positioned as an **upgrade, not an escape hatch**: unlimited replays, host tools, robust personal stats, profile flair/customization, priority discovery — with ad-free as one perk among several.
- FR-3.4.3: Conversion planning assumption: 2–3% of MAU (Letterboxd-benchmark freemium).

### 3.5 Creator Revenue — 50% of Net
- FR-3.5.1: **Creator payout per room = 50% × (room-attributed ad revenue − room streaming cost), floored at zero.** Streaming cost computed from actual participant-minutes at the platform's blended per-minute rate (+ STT cost when the runner is active). This makes it structurally impossible for a room to lose the platform money via creator payouts.
- FR-3.5.2: Messaging requirement — framed transparently as: *"We split room profit with you 50/50 after infrastructure costs."*
- FR-3.5.3: **Joint rooms:** the creator half splits between co-creators by percentages agreed at room creation (default equal split). Fully automated; no manual adjudication.
- FR-3.5.4: Payouts via **Stripe Connect** (automated splits, payout schedules, and 1099 tax forms). No manual payroll operations, per the Solo-Operator Principle.

### 3.6 Extreme Transparency Dashboards
- FR-3.6.1: **Creator dashboard (from day 1):** per-room and aggregate views of listeners, listener-minutes, ad impressions by placement, gross room revenue, room streaming cost, net, creator share, pending payout, and payout history. Includes a projected-earnings calculator ("a weekly room this size earns ≈ $X/mo") so creators see exactly what they can earn before they've earned it. Robust statistics: audience retention curves, peak concurrency, runner-link tap-through, replay performance.
- FR-3.6.2: **Founder margin dashboard (internal):** revenue-per-DAU vs cost-per-DAU by cohort (free heavy listeners, free browsers, premium), room-level P&L, network eCPM/fill trends. This is the instrument that decides *if* a listening cap is ever needed — data-driven, not guessed.
- FR-3.6.3: Honest creator expectation-setting is a product requirement: at small scale, ad shares are modest (a 30-person weekly room ≈ single-digit dollars/month); ticketed events and audience growth are the creator earnings story early on.

### 3.7 Ticketed Events
- FR-3.7.1: Creators host paid Chatterboxes; **creator keeps 80%, platform 20%** (≈17% net of processing).
- FR-3.7.2: **All ticket sales via web checkout (Stripe), never iOS in-app purchase** — Apple's 30% would make the platform's take negative. App links out to purchase.
- FR-3.7.3: Ticketing, access control, refunds-per-policy, and payout splits are fully automated through Stripe Connect.

### 3.8 Self-Serve Promoted Chatterboxes (sales without sales calls)
- FR-3.8.1: A public, credit-card checkout page where studios, distributors, and indie filmmakers buy: featured placement for a Chatterbox, a film page takeover, or a runner-ad campaign, for a fixed price and duration.
- FR-3.8.2: Runs through the ad abstraction layer as a direct-sold campaign; auto-scheduled, auto-reported, auto-expired. The founder's industry contacts get a link, not a meeting.

---

## 4. Infrastructure & Cost Requirements

### 4.1 Audio
- FR-4.1.1: Launch on managed real-time audio (Agora reference: $0.99/1,000 participant-minutes; 10K free monthly minutes; tiered discounts >100K min; voice-only annual commit ≈ $0.695/1K). Evaluate Daily/100ms/LiveKit Cloud free tiers (5–10K free min) at signup time.
- FR-4.1.2: Planning constant: **each daily active audio user costs ≈ $0.90/month** (30–40 min/day). Every DAU must generate >$1/month blended revenue.
- FR-4.1.3: **Self-hosting trigger:** migrate to self-hosted LiveKit only when managed audio bills exceed ~$3K/month (expected 60–80% per-minute savings vs ops burden).
- FR-4.1.4: Lurkers in a channel incur audio subscription billing — connection lifecycle must aggressively disconnect idle/backgrounded clients.

### 4.2 Platform
- FR-4.2.1: Managed-everything stack (Supabase, Vercel, CDN) — no self-hosted infrastructure until forced by economics. Status page required.
- FR-4.2.2: STT per FR-2.4.1; billed per room, gated by the ≥10-listener threshold.

### 4.3 Cost/Revenue Model Targets (fixed-model, all-automated)
| Stage | MAU / DAU | Revenue/mo | Costs/mo | Net |
|---|---|---|---|---|
| Launch | 2K / 200 | ~$150 | ~$50 | +$100 |
| Traction | 10K / 1K | ~$2,800 | ~$1,650 | +$1,150 |
| Growth | 100K / 10K | ~$27,000 | ~$11,000 | +$16,000 |

Profitable on paper from month one; founder-salary scale expected between 30–60K MAU (~18–24 months).

---

## 5. Trust, Safety & Moderation (solo-operator design)
- FR-5.1: Hosts are accountable moderators of their Chatterboxes (explicit in ToS): mute, remove, block, report tooling.
- FR-5.2: AI moderation pipeline on transcripts/recordings (transcription + flagging) — doubles as an internal ML portfolio project.
- FR-5.3: Room cap (FR-2.1.2) keeps incident blast radius small at launch.
- FR-5.4: Recording is host opt-in only; clear participant disclosure when a room is recorded.
- FR-5.5: Business hygiene: form a dedicated LLC for MovieChatterbox; media liability insurance (~$1–2K/yr) once traffic is real.

---

## 6. Growth Mechanics (no ad budget, no sales team)
- FR-6.1: Recording-to-clip pipeline: every replay supports clip export for TikTok/YouTube/Reels — the recording feature is also the marketing engine.
- FR-6.2: SEO: entity pages, lists, reviews, and replay transcripts are indexable (Letterboxd's growth engine).
- FR-6.3: Creator import: film podcasters/YouTubers get better economics here (50%-of-net ads + 80% tickets + paid clubs later) than generic platforms.
- FR-6.4: Founder-hosted flagship programming: 3–5 scheduled Chatterboxes weekly at launch, anchored to the release calendar; leverage AI Makers Generation as the seed live audience.
- FR-6.5: Phase 2 (post-traction): paid Clubs (subscriber-only Chatterboxes, platform take 10–15%).

---

## 7. Deferred / Explicitly Rejected
- **Rejected:** 50% of *gross* ad share (loses money per listening minute); free listening caps at launch; individual full-screen takeover ads mid-conversation; iOS IAP for tickets; manual sales dependency; IMDb data licensing (enterprise-priced); self-hosted audio at launch.
- **Deferred:** true audio ad networks (scale-gated); paid Clubs; TV expansion of taxonomy beyond launch vertical; direct-sold sponsorship outreach (self-serve page only for now).

---



---

## 8. Existing Site Audit (moviechatterbox.com, July 2026)

Everything currently live carries forward into the restructure. Nothing is deprecated except the data-attribution line (see FR-8.3).

| Existing feature | Status in restructure |
|---|---|
| Browse Movies with Trending / Top Rated sorts | **Keep** → folds into Database layer (§2.2); extend with filters per §9 |
| Live Rooms page + "Start a Room" | **Keep** → becomes the live audio pillar (§2.1), renamed per §10 |
| "Live Hallway" discovery surface | **Keep** → renamed **the Lobby** (§10); gains scheduled-event calendar |
| Live / listening / speaking counters | **Keep** → feeds creator dashboards (FR-3.6.1) |
| "Live Now" / "Past Rooms" tabs | **Keep** → Past Rooms becomes the Replays system (FR-2.1.4) with ad inventory + clip export |
| Profile page | **Keep** → rebuilt around lists per §2.3 |
| Watchlist | **Keep** → becomes a default system list on every profile |
| My Reviews / My Ratings | **Keep** → extend to diary-style logging per §9 |
| Room attachment to movies, directors, actors | **Keep** → generalizes to all entity types (FR-2.1.1) |

- FR-8.1: Migration must preserve all existing user accounts, ratings, reviews, and watchlists.
- FR-8.2: Existing Supabase/Vercel/OAuth stack is retained (FR-4.2.1).
- FR-8.3: At rebrand, all movie/TV data and its attribution follow TMDB commercial license terms (FR-2.2.1).

---

## 9. Competitor Feature Absorption

Features reviewed across IMDb, Letterboxd, and Clubhouse; classified as **Absorb** (build), **Adapt** (build modified), or **Skip** (with reason).

### 9.1 From IMDb (database & reference depth)
| Feature | Decision | Notes |
|---|---|---|
| Title pages: cast/crew, plot, runtime, genres, certifications | **Absorb** | TMDB-backed entity pages (§2.2) |
| Person pages with full filmography | **Absorb** | Runner links depend on these (FR-2.4.3) |
| Episode guides (season/episode hierarchy) | **Absorb** | Required for "episode 4 gets linked" runner behavior |
| Trivia / goofs / quotes | **Adapt** | User-contributed "Talking Points" on entity pages — designed as conversation fuel and Chatterbox prompts, not encyclopedia |
| Charts (Top 250-style, popularity meter) | **Adapt** | MCB charts driven by platform-native signal: most-discussed, most-listed, rating trends |
| Advanced search + keyword browsing | **Absorb** | Phase 2; basic genre/decade/person search at launch |
| Photo galleries / trailers | **Adapt** | Embed trailers via TMDB/YouTube; skip hosted galleries (rights burden) |
| Parents guide, box office, technical specs | **Skip** | Reference-desk depth without conversation value; disproportionate data cost |
| IMDbPro | **Skip** | B2B product; violates Solo-Operator Principle |
| News/editorial | **Skip** at launch | Replays + transcripts are MCB's editorial content instead |
| Where-to-watch | **Absorb** | Already specced with affiliate revenue (FR-2.2.3) |

### 9.2 From Letterboxd (identity, logging & lists)
| Feature | Decision | Notes |
|---|---|---|
| Diary logging (watch date, rewatch flag) | **Absorb** | Extends existing My Ratings/Reviews |
| Half-star ratings (0.5–5) | **Absorb** | Migrate existing ratings on import |
| Reviews with likes + comments | **Absorb** | Comment threads unify with entity text threads (FR-2.2.2) |
| Lists: ranked, tagged, collaborative | **Absorb** | Core of §2.3; every list item exposes "open a Chatterbox about this" |
| Watchlist | **Keep/Absorb** | Exists today |
| Four Favorites on profile | **Adapt** | "Marquee" slots on MCB profiles — favorites double as one-tap Chatterbox starters |
| Profile stats (Pro) | **Absorb as Premium perk** | Already in FR-3.4.2 |
| Streaming-service filter (Pro) | **Absorb as Premium perk** | Pairs with where-to-watch data |
| Activity feed / following | **Absorb** | Extends to live signal: "someone you follow is speaking now" |
| Year-in-review recap | **Absorb** | Cheap, viral, annual marketing moment (FR-6.x) |
| Tags + private notes | **Absorb** | Low cost, power-user retention |
| Custom posters/backdrops (Patron) | **Adapt** | Premium profile flair per FR-2.3.3 |
| Video Store (TVOD rentals) | **Skip** | Rights licensing is a multi-person business; affiliate links capture the intent instead |
| Journal (editorial arm) | **Skip** | Headcount-dependent |

### 9.3 From Clubhouse (live audio mechanics)
| Feature | Decision | Notes |
|---|---|---|
| Stage model: host / speakers / audience, raise hand, invite to stage | **Absorb** | Core room mechanics (FR-2.1.2) |
| Room privacy tiers: open / social (followers) / closed (invite) | **Absorb** | Closed rooms also serve ticketed events (§3.7) |
| Hallway discovery | **Absorb** | Exists as Live Hallway → the Lobby (§10) |
| Scheduled events with reminders | **Absorb** | Already specced (FR-2.1.3); Clubhouse proved demand |
| Clubs (persistent communities) | **Absorb — Phase 2** | Becomes paid Clubs monetization (FR-6.5) |
| Ping/invite friends into a live room | **Absorb** | Key growth loop |
| In-room text chat | **Absorb** | Doubles as the graceful-degradation channel (FR-2.1.5) |
| In-room reactions (emoji) | **Absorb** | Cheap engagement signal for dashboards |
| Clips (short shareable excerpts) | **Absorb** | Already the marketing engine (FR-6.1) |
| Replays | **Absorb** | Already specced (FR-2.1.4) |
| Tipping | **Adapt — deferred** | Clubhouse proved tips alone don't retain creators; MCB leads with ad share + tickets. Revisit via Stripe Connect later |
| Music mode / spatial audio | **Skip** at launch | Cost and complexity without conversation value |
| Back-channel DMs | **Adapt** | Launch scope: reply-in-thread and room invites only; full DMs are a moderation surface a solo operator should defer |

- FR-9.1: Absorb-class features are launch-scope unless marked Phase 2; Adapt-class items enter the backlog with their modified spec above.

---

## 10. Product Naming (Ratified)

Live audio rooms are **Chatterboxes**. The live discovery surface is **the Lobby** (rename of the existing "Live Hallway").

1. **"Chatterbox" is self-describing and self-marketing.** "Open a Chatterbox about Dune" tells a new user exactly what happens inside (talking), and every screenshot, clip, and invite repeats the brand.
2. **"The Lobby"** is the cinematic space where you *talk about* the movie — a perfect metaphor for an audio-conversation platform.

- FR-10.1: All UI copy, URLs (`/rooms` → `/chatterboxes` with redirects), notifications, and marketing adopt Chatterbox/Lobby terminology consistently at rebrand.
- FR-10.2: Chatterbox and Lobby are the only product terms for these constructs across UI copy, marketing, and documentation.

---



## 11. AI Interest Profiling & Personalized Recommendations

The system continuously builds an interest profile for each user and uses it to drive highly targeted recommendations across every surface of the app.

### 11.1 Interest Profile (per user, continuously updated)
- FR-11.1: Profile signals include, at minimum: ratings, reviews, diary logs, lists created/followed, watchlist contents, entities browsed and dwell time, Chatterboxes joined/hosted, listening duration by topic, speaking activity, runner-link taps, replay consumption, follows, reactions, and search queries.
- FR-11.2: Conversation-derived signal: room transcripts (already produced for the runner, FR-2.4.1) are mined for topical interest at the *room* level and attributed to participants as interest signal (e.g., attended three A24 horror rooms this month). This is MCB's proprietary edge — no competitor has live conversation signal.
- FR-11.3: Profiles are represented as evolving interest vectors (genres, people, eras, franchises, themes) with time decay so recent behavior outweighs stale history.
- FR-11.4: Architecture fits the founder's ML pipeline skills: embedding-based retrieval (entity + user embeddings) with a lightweight ranking layer; batch recompute nightly, incremental updates on high-signal events. Start with heuristic/collaborative filtering at launch scale; graduate to learned embeddings as data accumulates.

### 11.2 Recommendation Surfaces
- FR-11.5: Personalized surfaces: home feed ordering, Lobby ordering (which live Chatterboxes to show first), "scheduled Chatterboxes you'd like," entity-page "more like this," list suggestions, people-to-follow, replay recommendations, and push/digest notifications ("a Chatterbox about a film on your watchlist starts in 1 hour").
- FR-11.6: Ad targeting: interest profiles inform contextual ad selection (runner ad slots, Promoted Chatterbox matching) within ad-network policy constraints.
- FR-11.7: Recommendations must be explainable in-UI ("Because you loved Hereditary and follow 3 horror lists") — transparency drives trust and engagement.
- FR-11.8: All recommendation computation obeys the Solo-Operator Principle: fully automated pipelines, no manual curation dependencies.

## 12. Terms of Service & Data-Use Policy Requirements

- FR-12.1: The ToS and Privacy Policy shall **explicitly and prominently state that all data shared on or generated through use of the app** — including profile information, ratings, reviews, lists, browsing and listening activity, and the content of live audio conversations and their transcripts — **is used to build individual interest profiles for personalization, recommendations, advertising relevance, and other related profiling purposes.**
- FR-12.2: Consent is captured at signup (affirmative acceptance, not buried); recording/transcription of Chatterboxes is disclosed in-room (FR-5.4 notice extends to profiling use).
- FR-12.3: Compliance guardrails (required for app-store approval and by law in key markets): a privacy policy accessible pre-signup; user rights to access, export, and delete their data and profile (GDPR/CCPA); Apple App Tracking Transparency prompts and Google Play Data Safety declarations accurately reflecting the profiling described in FR-12.1; voice/transcript data handling disclosed specifically, as several jurisdictions treat voice data as sensitive.
- FR-12.4: An in-settings "Your interest profile" view (plain-language summary of what the system believes the user likes, with reset option) — turning the disclosure obligation into a trust-building feature.

## 13. Future State: Theaters (Streaming Evolution)

Long-term platform vision, explicitly out of launch scope. Documented so near-term architecture doesn't foreclose it.

- FS-13.1: **Theaters are the reserved future construct**: synced video screening spaces where users watch licensed streaming content *together* with live social audio alongside — talk-while-you-watch, then spill into a Chatterbox after. The "Theater" name — rejected for audio-only rooms because it implies watching — becomes accurate here, and activates only with this feature. (FR-10.2 amended accordingly: "Theater" remains barred from product copy *until* synced viewing ships.)
- FS-13.2: The differentiator vs Netflix/Prime watch-party features: MCB Theaters sit inside a platform where the conversation, community, lists, and interest graph already live — watching is the beginning of the social loop, not a bolt-on.
- FS-13.3: Path dependency to honor now: entity pages, Chatterbox mechanics, replays, and interest profiles (§11) must all key on canonical content IDs so a video layer can attach to the same spine later. The ad abstraction layer (FR-3.2) must not assume audio/display-only formats.
- FS-13.4: Sober note for future planning: content licensing for streaming is a capital-intensive, multi-employee undertaking (AVOD/TVOD licensing, DRM, CDN economics). Realistic entry paths, in order: (a) embedded partner playback / affiliate deep-links into existing services with synced "watch together" coordination, (b) TVOD rentals of independent films — where the founder's indie film relationships are a genuine wedge (filmmaker-hosted premiere Theaters with Q&A), (c) licensed catalog streaming. This section triggers revisiting the Solo-Operator Principle; it is the scale-up chapter, not the company-of-one chapter.

---

*End of document — v1.3.*
