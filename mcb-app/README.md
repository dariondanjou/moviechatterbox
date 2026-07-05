# MovieChatterbox — Expo app

The v1.4 rebuild of [moviechatterbox.com](https://moviechatterbox.com): a single Expo (React Native) + TypeScript codebase targeting iOS, Android, and web. Product source of truth is the FRD (`../moviechatterbox-requirements.md`); standing instructions in `../CLAUDE.md`.

## Status: Foundation (build-order step 1)

- ✅ Expo SDK 57 scaffold with Expo Router (`src/app/`)
- ✅ Design-sync: tokens from the design handoff bundle in `src/theme/tokens.ts` (colors, type scale, spacing, radii, elevation); Baloo 2 + Outfit loaded in the root layout; brand assets in `assets/brand/`
- ✅ Supabase wiring: `src/lib/supabase.ts` points at the **existing production instance** — live users, ratings, reviews, watchlists carry over (FR-8.1)
- ✅ Auth: email/password sign-in + sign-up against existing Supabase auth, session persisted in AsyncStorage, foreground-only token refresh (`src/providers/auth-provider.tsx`)
- ✅ EAS profiles: `development` (dev client) / `preview` (internal) / `production` in `eas.json`

## Status: Audio core (build-order step 2) — in progress

- ✅ DB schema: `mcb_profiles`, `mcb_chatterboxes` (scheduled/live/ended), `mcb_participants` (host/speaker/listener + raise hand), `mcb_messages` — RLS on all, role changes guarded server-side, realtime enabled (`supabase/migrations/` in repo root)
- ✅ **LiveKit** (founder decision, supersedes Agora): `chatterbox-token` edge function mints role-scoped tokens (listeners can't publish); `livekit-client` on web, `@livekit/react-native` on native (needs a dev build)
- ✅ The Lobby: live + scheduled Chatterboxes, realtime updates, start FAB
- ✅ Start flow: go live now or schedule (quick presets)
- ✅ Chatterbox screen: stage/audience, raise hand, host invite-to-stage/demote, mute, in-room text chat (also the audio-failure degradation channel per FR-2.1.5), emoji reactions via realtime broadcast, host End
- ✅ Verified end-to-end on web: sign-in → create → host on stage → chat → LiveKit audio connected → end
- ⏳ Remaining in step 2: recording/replays (FR-2.1.4), scheduled-box reminders + go-live transition, native dev-build audio test on real devices

Smoke-test login: `mcb-smoketest@example.com` / `mcb-smoke-Passw0rd!`

Next after step 2: database layer (TMDB ingestion → entity pages).

## Run it

```bash
cp .env.example .env   # fill with the web app's NEXT_PUBLIC_SUPABASE_* values
npm install
npm run web            # or: npm run android / npm run ios
```

## EAS

First-time setup (interactive, needs an Expo account):

```bash
npx eas init                                # links the project (sets extra.eas.projectId)
npx eas build --profile development         # dev client for real-device testing
```

Audio features must be tested on real devices only — emulators lie about audio routing (CLAUDE.md).

## Known gaps (deliberate, foundation scope)

- App icons/splash are template placeholders except the splash glyph; proper 1024px brand icons needed before store builds.
- OAuth providers (e.g. X) need a native deep-link flow (`expo-auth-session`); email/password works now.
- `eas init` not yet run — requires the founder's Expo account login.

## Naming rules (hard requirement)

Live audio rooms are **Chatterboxes**; the live discovery surface is **the Lobby**. The words "room" and "theater" never appear in UI copy or URLs (FR-10.x).
