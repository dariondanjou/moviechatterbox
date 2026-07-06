# Handoff: MovieChatterbox Design System + 5 Key Screens

## Overview
Complete dark-first design system and five key mobile screens for **MovieChatterbox** — a social audio platform for movie/TV lovers (Clubhouse-style live audio "Chatterboxes" × IMDb-style database × Letterboxd-style profiles/lists). Target: **React Native (iOS/Android) mobile-first**, with a web companion. Product requirements source of truth: `moviechatterbox-requirements.md` (FRD v1.3, included).

**Naming rules (hard requirement, FR-10.x):** live rooms are always **"Chatterboxes"**, the live discovery surface is **"the Lobby"**. Never "rooms" or "theaters" in UI copy.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the target codebase's environment** (React Native + the existing Supabase/Vercel web stack) using its established patterns. `MovieChatterbox Design System.dc.html` opens directly in a browser; all styling is inline on each element, so exact values can be read straight off the markup.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and copy are final intent. Recreate pixel-perfectly. Exceptions: all **poster artwork is placeholder gradient art** (awaiting TMDB-licensed imagery) and avatar fills are placeholder gradients.

## Brand Foundation
Built outward from the actual logo (included in `assets/`):
- Wordmark: extra-bold rounded lowercase; "movie"+"box" in near-black (inverts to cream `#F7F4EF` on dark UI), "chatter" in brand orange `#F5871F`.
- Icon: retro-TV speech bubble, **black** in source (recolored cream/orange for dark surfaces — see `assets/icon-cream.png`, `assets/icon-orange.png`, `assets/wordmark-dark.png`).
- Rounded geometry from the logotype drives everything: pill buttons, large corner radii, organic "blob" avatars.
- Display type approximates the wordmark: **Baloo 2** (Google Fonts, 600/700/800). UI type: **Outfit** (400–800).

## Design Tokens

### Color
| Token | Value | Use |
|---|---|---|
| bg/screen | `#0E0D0B` | app background (warm near-black) |
| bg/desk | `#0A0A0B` | canvas/desktop background |
| surface/1 | `#171613` | opaque raised surface |
| surface/board | `#121113` | spec-board panels |
| glass | `rgba(247,244,239,0.045–0.08)` + 1px border `rgba(247,244,239,0.09–0.14)` | cards, chips, tiles |
| glass/heavy | `rgba(28,26,22,0.75)` + `backdrop-filter: blur(16px)` | runner cards, sheets |
| text/primary | `#F7F4EF` | |
| text/secondary | `rgba(247,244,239,0.6)` | |
| text/tertiary | `rgba(247,244,239,0.38–0.45)` | labels, meta |
| ink/on-orange | `#1A0F03` | text on orange fills |
| orange/100 | `#FFD9B0` | |
| orange/300 | `#FFA84D` | bright accents, money numerals |
| **orange/500 ★** | `#F5871F` | primary accent, everything live |
| orange/600 | `#C4670A` | pressed |
| orange/900 | `#4A2606` | deep tint |
| orange glow | `rgba(245,135,31,0.35–0.55)` | shadows, speaking pulses |
| semantic/live | `#F5871F` | LIVE badges, speaking rings |
| semantic/recording | `#E5484D` (text `#FF8A8E`) | REC |
| semantic/premium | `#E8C15E` (on `#2A1F04`) | premium flair, Marquee borders |
| semantic/positive | `#6FCF8E` (on `#06210F`) | earnings, growth deltas |

### Type scale (mobile)
| Style | Font | Weight | Size |
|---|---|---|---|
| display | Baloo 2 | 800 | 34 (26–30 in-screen headers) |
| title | Outfit | 700 | 24 |
| heading | Outfit | 600–700 | 16–18 |
| body | Outfit | 400 | 15 |
| label | Outfit | 600 | 13 |
| micro | Outfit | 700 | 11, uppercase, letter-spacing 0.12–0.14em |

### Spacing & radius
- Spacing: 4pt base — 4/8/12/16/20/24/32/40.
- Radius: r-10 (small thumbs), r-16 (cards), r-18–24 (large cards/sheets), pill `999px` (all buttons/badges/chips), screen corners 44.
- Blob avatar: `border-radius: 40% 60% 55% 45% / 50% 45% 55% 50%` (vary per instance for organic feel).

### Elevation / depth
- Elevated cards: `inset 0 1px 0 rgba(255,255,255,0.06–0.08)` (thin luminous top edge).
- Live/featured: orange border `rgba(245,135,31,0.3)` + `0 0 30–40px rgba(245,135,31,0.08–0.12)` glow.
- Sheets/bars: `backdrop-filter: blur(20–24px)` over `rgba(16,15,13,0.85–0.92)`.

### Iconography
1.8px stroke, `stroke-linecap: round`, geometric, 22–24px grid. Filled variant only for active tab and play glyphs. No emoji except in-room reactions (product feature).

## Core Components (see board 1b)
- **Buttons**: primary = orange pill, ink text, orange glow shadow; secondary = glass pill; ghost = orange text; destructive = red-tinted glass pill; disabled = 5% glass, 30% text.
- **Poster card**: 2/3 aspect, r-12–14, 1px glass border, title bottom-left.
- **List card**: fanned 3-poster stack (rotations −3°/0°/+6°), name + count.
- **Replay card**: glass row, circular orange-tinted play button, `Replay · duration` micro-label.
- **Avatar states**: listening (plain blob) / speaking (2–3px orange border + pulse: box-shadow 0→9px orange fading, 1.8s ease-out infinite) / host (speaking + orange HOST chip bottom-center) / muted (75% opacity + red mic-off dot bottom-right).
- **Live badges**: LIVE (orange fill, blinking dot 1.4s), REC (red-tinted glass), scheduled time chip (glass), ✦ PREMIUM (gold-tinted), AD (dashed-border glass chip).
- **Bottom tab bar**: blurred dark bar, 5 slots — Lobby (TV icon), Browse (search), center raised orange **+** FAB (−30px offset, 4px screen-bg ring), Activity (waveform bars), Profile. Active = orange fill + 700 label.
- **Sheet modal**: r-26 top corners, drag handle, blur(20px), attached-entity row, primary action pill.
- **Stat tile**: glass, micro label + Baloo 2 800 numeral + delta in positive green. Money tiles get orange border + glow.
- **Native ad container**: same geometry as content cards, but **dashed border `rgba(247,244,239,0.22–0.25)`, mandatory bordered "AD" chip + "Sponsored" text, muted surface gradient**. Harmonizes without impersonating content (FR-2.4.5, AD-3/AD-4).

## Screens / Views

### 1c — The Lobby (home)
Header: orange TV icon + "the lobby" (Baloo 2 800, lowercase) + search + avatar. Sections: "Live now" (count chip, See all) → featured live card (poster-gradient backdrop under 35% scrim + blur(2px), orange border+glow, LIVE badge, listener count, 19px/700 topic title, film chip, overlapping speaker blob avatars with speaking pulses, glass Join pill) → compact live row card → "Coming up" horizontal rail (time chip, title, reminded count, orange "Remind me") → recommendation shelf titled by theme ("Slow-burn dread") with explainability subtitle **"Because you loved Hereditary and follow 3 horror lists"** (FR-11.7) + poster row with ratings. Tab bar: Lobby active.

### 1d — Live Chatterbox (flagship)
Full-bleed film-poster backdrop (radial gradients) under `rgba(14,13,11,0.55)` + blur(30px). Header: collapse chevron, LIVE + REC badges, listener count, 21px/700 room title, attached-film chip ("tap for film page"). Stage: 3 large (74px) speaker blobs — host (orange ring, pulse, HOST chip), speaker (pulsing), muted speaker (mic-off dot); "LISTENING · 125" label + 44px audience blob grid + "+118" overflow. **Conversational Runner** (FR-2.4): label row with 3 animated waveform bars + "RUNNER · FOLLOWING THE CONVERSATION"; horizontally scrolling rail of 148px glass cards, each with type tag (FILM/PERSON/LIST in orange/300), thumb, title, meta, and a **decay-timer bar** (3px, orange fill at varying %). Rail renders mid-scroll: earlier card clipped off left edge, next card peeking right. **Every 4th slot is the native ad card** (dashed border, AD chip + Sponsored) — must remain clearly visible. Bottom controls on blurred bar: "✌️ Leave quietly" glass pill, reaction 🖤, raise-hand ✋ (46px circles), orange mic button (52px, glow).

### 1e — Film entity page (Hereditary)
240px hero backdrop fading into screen bg, floating back/overflow buttons on blurred circles. Title block overlaps hero (−58px): 104×154 poster with heavy shadow, Baloo 2 800 30px title, meta line "2018 · 2h 7m · R · Horror", orange stars + 4.3 + count. CTAs: **primary "Start a Chatterbox"** (mic icon) + "+ Watchlist" glass. "WHERE TO WATCH" chip row (Max, Prime Video, Apple TV, +3). "Chatterboxes": live row (orange border/glow, LIVE) + scheduled row (clock, "Remind"). "Replays": horizontal cards (play button, duration, plays). "Reviews": glass card with avatar, @handle, ★ rating, body text. Tab bar: Browse active.

### 1f — User profile
Identity: 80px blob avatar in **gold→orange gradient ring** (premium flair) + "✦ PREMIUM" chip, Baloo 2 name, @handle + bio, followers/following/films stats. **"✦ MARQUEE"** (gold label, "four favorites · tap to talk"): 4-across poster grid with gold borders — each is a one-tap Chatterbox starter (FRD §9.2). "Lists": two tactile fanned poster-stack cards with counts/likes. "Diary": rows with poster thumb, title, meta (rewatch ↺, "hosted a Chatterbox"), orange star ratings incl. half stars. Tab bar: Profile active.

### 1g — Creator dashboard
"creator studio" (Baloo 2) + month selector chip. **Earnings hero** (orange-tinted gradient card): "Your share · June" → $148.12 (Baloo 2 800 38px, orange/300), green delta chip, and an inline **math strip: Gross $412.30 − Streaming $116.06 = Net $296.24 (green)**, caption "We split room profit with you 50/50 after infrastructure costs. Paid via Stripe on the 1st." (FR-3.5.2). 3×2 stat tiles: Listeners, Listener-min, Ad impressions, Peak concurrent, Runner taps, Replay plays. **Audience retention** card: line chart 0–60m with orange stroke + 14% fill, "avg listen 24m". **Projection** card (FR-3.6.1): "Projected: ≈ $58/mo — a weekly Chatterbox at your current size. Grow to 500 avg listeners → ≈ $210/mo." Payout history rows: date + Stripe ····4187, amount, green PAID chip. No tab bar (studio context).

## Interactions & Behavior
- Speaking pulse: `box-shadow 0 0 0 0 rgba(245,135,31,.55)` → `0 0 0 9px` transparent, 1.8s ease-out infinite; stagger delays across avatars.
- LIVE dot blink: opacity 1→0.35→1, 1.4s.
- Runner waveform bars: 3 bars, heights oscillating, 0.8–1.1s loops.
- Runner cards: horizontal scroll; each card's decay bar drains as topic shifts (FR-2.4.4); tapping opens the entity page **without leaving room audio** (FR-2.4.6). Below 10 listeners the runner is replaced by host manual pinning (FR-2.4.2) — not mocked.
- Featured Join, Remind me, Start a Chatterbox → respective flows; sheet modal (1b) is the Start flow: attach entity → "Go live now" / "Schedule for later".
- Tab bar center FAB opens the Start sheet.
- Live Chatterbox screen degrades to text thread if audio fails (FR-2.1.5) — not mocked.

## State Management (per screen, minimum)
- Lobby: live boxes list (LIVE, listener counts — realtime), scheduled events + reminded state, personalized shelves w/ explanation strings.
- Live Chatterbox: participants (role: host/speaker/listener; speaking; muted), recording flag, listener count, runner queue (typed entity cards + decay %, ad every 4th), hand-raised, reactions.
- Film page: entity metadata, watch providers, live/scheduled boxes, replays, reviews, watchlist membership.
- Profile: premium flag (toggles gold ring/chip), marquee[4], lists, diary entries.
- Dashboard: month selector, earnings breakdown (gross/cost/net/share), 6 stats, retention curve series, projection, payouts.

The prototype exposes three demo toggles (Tweaks props): `showRunnerAds`, `recordingBadge`, `premiumProfile`.

## Assets
- `assets/wordmark-dark.png` — full lockup recolored for dark UI (cream + orange)
- `assets/icon-cream.png`, `assets/icon-orange.png` — TV speech-bubble icon recolored
- `uploads/logo-moviechatterbox.png`, `uploads/logo-chatterbox.png` — original source logos (black/orange on white)
- Google Fonts: Baloo 2, Outfit
- All poster/avatar art = gradient placeholders; replace with TMDB-licensed imagery (FR-2.2.1)

## Screenshots
`screenshots/` contains a reference image per board/screen (`1a-foundations` … `1g-creator-dashboard`). Note: these are DOM-render captures — `backdrop-filter` blur and some glow effects render flatter than in the live HTML. **Treat the HTML file as visual ground truth**; screenshots are for orientation.

## Files
- `MovieChatterbox Design System.dc.html` — the full deliverable: foundations board (1a), components board (1b), and screens 1c–1g. All styles inline; ids `1a`–`1g` anchor each board.
- `moviechatterbox-requirements.md` — FRD v1.3 (product source of truth)
