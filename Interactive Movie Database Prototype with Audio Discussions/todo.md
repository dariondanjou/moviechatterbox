# CineVerse TODO

## Phase 1: Foundation
- [x] Design system: CSS tokens, fonts, color palette (orange #FF6B35, black #1A1A1A, white)
- [x] Database schema: movies, persons, genres, cast, crew, reviews, watchlists, rooms, messages
- [x] Drizzle migrations applied

## Phase 2: Data & API
- [x] Seed script: 1,060+ movies with metadata, posters, genres
- [x] Seed script: persons (actors, directors) with bios and photos
- [x] Seed script: cast/crew relationships
- [x] tRPC procedures: movies (list, detail, search, filter, featured, trending, topRated)
- [x] tRPC procedures: persons (detail, list)
- [x] tRPC procedures: genres list
- [x] tRPC procedures: ratings (upsert, myRating, myRatings)
- [x] tRPC procedures: reviews (list, create, myReviews)
- [x] tRPC procedures: watchlist (list, toggle, isWatchlisted, markWatched)
- [x] tRPC procedures: threads (list, detail, create, reply)
- [x] tRPC procedures: rooms (list, detail, create, join, leave, raiseHand)
- [x] tRPC procedures: user (updateProfile)

## Phase 3: Core Pages
- [x] Global Navbar with search, auth, watchlist link
- [x] Footer with links
- [x] Home page: hero carousel, live rooms strip, trending, top rated, genre browser, full rooms section
- [x] Browse/Search page: movie grid (1,063 titles), search, sort, filter by genre/year/rating, pagination

## Phase 4: Movie & Person Pages
- [x] Movie Detail page: hero backdrop, poster, metadata, cast/crew tabs, reviews tab, discussion tab
- [x] Movie Detail: related movies section
- [x] Person Profile page: bio, photo, acting + directing filmography grid
- [x] Thread Detail page: threaded replies

## Phase 5: User Features
- [x] Auth: login/logout with Manus OAuth
- [x] User profile page with stats
- [x] Watchlist page: add/remove, watched/unwatched toggle
- [x] User ratings (1-10 stars) per movie
- [x] User reviews per movie with spoiler warnings

## Phase 6: Discussion Boards
- [x] Discussion board per movie (Discuss tab on movie detail)
- [x] Post new thread / reply to thread
- [x] Thread detail page with replies

## Phase 7: Live Audio Rooms
- [x] Hallway page: list of active rooms with participant count, search
- [x] Room creation form
- [x] Room UI: stage (speakers) + audience section with profile pics
- [x] Room: related movie poster, related person, "Also Mentioned" links sidebar
- [x] Room: raise hand to speak, join/leave
- [x] Room related links seeded (49 links across 12 rooms)
- [x] Room links enriched with movie/person slugs and posters

## Phase 8: Floating Audio Controls
- [x] Floating audio bar: persists across page navigation
- [x] Mute/unmute toggle
- [x] Leave room button
- [x] Room name display with link back
- [x] AudioRoomContext for global state
- [x] Stage/audience mode toggle

## Phase 9: Polish & QA
- [x] Responsive design: mobile, tablet, desktop
- [x] Loading skeletons for all data-heavy pages
- [x] Empty states and error states
- [x] Movie crawler script (OMDB API based)
- [x] 19 Vitest unit tests passing
- [x] TypeScript no errors
- [x] Slug consistency: all movies have year-suffixed slugs

## Future Enhancements
- [ ] Real WebRTC audio (currently simulated UI prototype)
- [ ] Movie crawler continuous enrichment from IMDB/RT/Letterboxd
- [ ] Admin panel for content management
- [ ] Social features: follow users, activity feed
- [ ] Movie lists (curated collections)
- [ ] Mobile app
