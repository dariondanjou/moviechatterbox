# CLAUDE.md — MovieChatterbox

Standing instructions for Claude Code. Read before every task.

## What this is

MovieChatterbox is a social audio platform for movie and TV lovers — live audio rooms (Chatterboxes) fused with a film/TV database and Letterboxd-style profiles and lists. A Darion D'Anjou project, built and operated by one person.

**Source of truth:** `docs/requirements.md` (FRD v1.4). Consult it before implementing any feature. Reference FR numbers in commit messages (e.g., `feat: room lifecycle (FR-2.1.3)`). If a task conflicts with the FRD, stop and ask — don't silently deviate.

**Design source of truth:** the Claude Design handoff bundle + `/design-sync` output. All UI uses design-system tokens and components. Never hardcode colors, radii, or type sizes. If a needed component doesn't exist in the system, flag it rather than improvising off-system.

## Non-negotiable rules

1. **Naming:** Live audio rooms are **Chatterboxes**. The live discovery surface is **the Lobby**. The words "room" and "theater" never appear in UI copy, URLs, marketing strings, or user-facing docs. (Internal variable names may use `room` where SDKs require it, e.g. Agora channel APIs.)
2. **Audio-first (FR-2.1.6):** Live audio ships in v1.0. Text chat in Chatterboxes is a companion + degradation channel (FR-2.1.5), never a substitute.
3. **Solo-Operator Principle (§1.2):** Every feature must run without ongoing manual sales, accounting, or babysitting. If an implementation requires recurring human intervention, it's wrong — redesign it.
4. **Money math (FR-3.5.1):** Creator payout = 50% × (room-attributed ad revenue − room streaming cost − transcription cost when runner active), floored at zero. Joint rooms split the creator half by agreed percentages (default equal). All ledger math lives server-side, never client-side.
5. **No iOS IAP for tickets or subscriptions (FR-3.7.2, FR-3.4.1):** Payments via Stripe web checkout with link-out. Never implement StoreKit purchases for these.
6. **Data provenance:** All film/TV metadata and imagery from TMDB (licensed) and Wikidata (CC0) only. Never scrape or import from IMDb, Rotten Tomatoes, Letterboxd, or IMDb's non-commercial datasets. TMDB data is never used for ML training.
7. **Privacy (FR-12.x):** Recording and transcription are host opt-in with in-room disclosure. Profiling uses are disclosed per FR-12.1. Any new data collection must be reflected in the privacy policy and store data-safety declarations — flag when a change requires this.

## Stack

- **App:** Expo (React Native) + TypeScript, Expo Router. Single codebase: iOS, Android, web.
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage). Existing production instance — migrations must preserve live users, ratings, reviews, watchlists (FR-8.1). Never run destructive migrations without an explicit go-ahead.
- **Live audio:** Agora RN SDK. Aggressively disconnect idle/backgrounded clients (FR-4.1.4) — lurker minutes are billed.
- **Transcription:** Deepgram streaming, one stream per Chatterbox, gated at ≥10 listeners (FR-2.4.2).
- **Payments:** Stripe (subscriptions) + Stripe Connect (creator payouts, 1099s).
- **Ads:** AdMob/AdSense behind AppLovin MAX mediation — but ALL placement decisions go through our internal ad service (FR-3.2). UI code never calls ad SDKs directly.
- **Builds:** EAS. Profiles in `eas.json`: `development` (dev client), `preview` (TestFlight/Play internal), `production`. OTA fixes via EAS Update for JS-only changes.

## Architecture invariants

- Every content entity (film, show, season, episode, person, list) keys on a canonical internal ID mapped to TMDB/Wikidata IDs (FS-13.3). Chatterboxes, replays, runner cards, lists, and interest profiles all reference these canonical IDs.
- The ad service is the single chokepoint: "show ad of type X in context Y, attribute to creator Z." Fill sources (mediation, direct-sold, promoted) are interchangeable behind it.
- Every ad impression writes to the revenue ledger with room ID, creator ID(s), placement type, eCPM.
- Interest-profile signals (FR-11.1) are emitted as events from day one, even before the recommender exists — the data asset starts accumulating immediately.
- Audio failure degrades to the room's text thread without losing room state.

## Working style

- One FR section per session where possible. Small, reviewable diffs. Feature branches, descriptive commits.
- Before building any screen, check the design bundle for an existing pattern.
- Write tests for ledger math, payout splits, and entitlement logic — money code gets tests before merge, no exceptions.
- When adding a native module, note that it requires a new dev build (`eas build --profile development`) — call this out explicitly.
- Test audio features on real devices only; emulators lie about audio routing, echo, and backgrounding.
- If a third-party service/tier/price is assumed (Agora rates, TMDB terms, Playwire minimums), verify current terms before hardcoding thresholds.

## Build order (v1.4, audio-first)

1. Foundation: scaffold, EAS, design-sync, Supabase wiring, auth migration
2. Audio core: Agora integration → stage roles → room lifecycle → in-room text/reactions → Lobby → recording/replays
3. Database layer: TMDB ingestion → entity pages → profiles → ratings/watchlist migration (lists/diary depth may follow post-launch via OTA)
4. Store release: TestFlight + Play closed beta (real multi-user audio testing), moderation/report/block tooling working before submission (UGC review requirement)
5. Runner: Deepgram → entity matching → runner rail → every-4th-slot native ad
6. Monetization: ad service → mediation → premium (Stripe web) → Connect ledger → creator dashboard → ticketed events

## Standing authorization (don't ask, just do)

Proceed without confirmation for anything inside the current build-order step: writing code, local package installs, feature-branch commits, running builds/tests/exports, and local scripts. Pick sensible defaults and note the decision in your summary instead of asking.

Always stop and ask before: production Supabase migrations or any destructive data operation, deploys, pushing to remotes, spending money or signing up for external services (TMDB commercial, Agora, Stripe, EAS paid tiers), and anything requiring the founder's account logins.

## Current status

- Existing production web app at moviechatterbox.com (Vercel + Supabase) with live users — treat its data as precious.
- Rebrand/rebuild in progress per FRD v1.4. Logo: founder-designed teal monoline rounded wordmark.
- Launch vertical: horror (strategic posture, §1.3). Launch programming is scheduled-events-led; open room creation may be feature-flagged off at first.
