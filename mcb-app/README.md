# MovieChatterbox — Expo app

The v1.4 rebuild of [moviechatterbox.com](https://moviechatterbox.com): a single Expo (React Native) + TypeScript codebase targeting iOS, Android, and web. Product source of truth is the FRD (`../moviechatterbox-requirements.md`); standing instructions in `../CLAUDE.md`.

## Status: Foundation (build-order step 1)

- ✅ Expo SDK 57 scaffold with Expo Router (`src/app/`)
- ✅ Design-sync: tokens from the design handoff bundle in `src/theme/tokens.ts` (colors, type scale, spacing, radii, elevation); Baloo 2 + Outfit loaded in the root layout; brand assets in `assets/brand/`
- ✅ Supabase wiring: `src/lib/supabase.ts` points at the **existing production instance** — live users, ratings, reviews, watchlists carry over (FR-8.1)
- ✅ Auth: email/password sign-in + sign-up against existing Supabase auth, session persisted in AsyncStorage, foreground-only token refresh (`src/providers/auth-provider.tsx`)
- ✅ EAS profiles: `development` (dev client) / `preview` (internal) / `production` in `eas.json`

Next per build order: audio core (Agora integration → stage roles → Chatterbox lifecycle → the Lobby).

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
