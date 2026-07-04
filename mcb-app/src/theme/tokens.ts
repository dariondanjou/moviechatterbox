/**
 * MovieChatterbox design tokens.
 *
 * Source of truth: "MovieChatterbox design system" handoff bundle
 * (design_handoff_moviechatterbox/README.md + Design System .dc.html).
 * Never hardcode colors, radii, or type sizes in components — import from here.
 */

export const color = {
  // Backgrounds
  bgScreen: '#0E0D0B', // app background (warm near-black)
  bgDesk: '#0A0A0B', // canvas/desktop background
  surface1: '#171613', // opaque raised surface
  surfaceBoard: '#121113', // spec-board panels

  // Glass (cards, chips, tiles)
  glass: 'rgba(247,244,239,0.06)',
  glassStrong: 'rgba(247,244,239,0.08)',
  glassBorder: 'rgba(247,244,239,0.11)',
  glassBorderStrong: 'rgba(247,244,239,0.14)',
  glassHeavy: 'rgba(28,26,22,0.75)', // runner cards, sheets (+ blur 16)

  // Text
  textPrimary: '#F7F4EF',
  textSecondary: 'rgba(247,244,239,0.6)',
  textTertiary: 'rgba(247,244,239,0.42)',
  inkOnOrange: '#1A0F03', // text on orange fills

  // Brand orange ramp
  orange100: '#FFD9B0',
  orange300: '#FFA84D', // bright accents, money numerals
  orange500: '#F5871F', // ★ primary accent, everything live
  orange600: '#C4670A', // pressed
  orange900: '#4A2606', // deep tint
  orangeGlow: 'rgba(245,135,31,0.45)', // shadows, speaking pulses
  orangeGlowSoft: 'rgba(245,135,31,0.35)',

  // Semantic
  live: '#F5871F',
  recording: '#E5484D',
  recordingText: '#FF8A8E',
  premium: '#E8C15E',
  premiumBg: '#2A1F04',
  positive: '#6FCF8E',
  positiveBg: '#06210F',

  // Ad containers (dashed border, must not impersonate content)
  adBorder: 'rgba(247,244,239,0.24)',
} as const;

/** 4pt base spacing scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radius = {
  sm: 10, // small thumbs
  md: 16, // cards
  lg: 20, // large cards
  xl: 24, // sheets
  sheet: 26, // sheet modal top corners
  pill: 999, // all buttons/badges/chips
  screen: 44,
} as const;

/**
 * Type scale (mobile).
 * Display: Baloo 2 (600/700/800). UI: Outfit (400–800).
 * Font family names match the keys loaded in src/app/_layout.tsx.
 */
export const font = {
  display: 'Baloo2_800ExtraBold',
  displaySemi: 'Baloo2_600SemiBold',
  displayBold: 'Baloo2_700Bold',
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semiBold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
  extraBold: 'Outfit_800ExtraBold',
} as const;

export const type = {
  display: { fontFamily: font.display, fontSize: 34 },
  displayHeader: { fontFamily: font.display, fontSize: 28 }, // 26–30 in-screen headers
  title: { fontFamily: font.bold, fontSize: 24 },
  heading: { fontFamily: font.semiBold, fontSize: 17 },
  body: { fontFamily: font.regular, fontSize: 15 },
  label: { fontFamily: font.semiBold, fontSize: 13 },
  micro: {
    fontFamily: font.bold,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 11 * 0.13,
  },
} as const;

/** Elevation / depth recipes. */
export const elevation = {
  /** Thin luminous top edge on elevated cards (use as borderTopColor 1px). */
  cardTopEdge: 'rgba(255,255,255,0.07)',
  /** Live/featured: orange border + glow. */
  liveBorder: 'rgba(245,135,31,0.3)',
  liveGlow: {
    shadowColor: '#F5871F',
    shadowOpacity: 0.12,
    shadowRadius: 35,
    shadowOffset: { width: 0, height: 0 },
  },
  /** Blurred sheets/bars sit over this tint (with expo-blur 20–24). */
  sheetTint: 'rgba(16,15,13,0.9)',
} as const;

/** Organic blob avatar radii — vary per instance for organic feel. */
export const blobRadius = {
  borderTopLeftRadius: '40%',
  borderTopRightRadius: '60%',
  borderBottomRightRadius: '55%',
  borderBottomLeftRadius: '45%',
} as const;
