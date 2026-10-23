export const Colors = {
  indigo950: '#171B36',
  indigo900: '#1E2444',
  indigo800: '#262C52',
  indigo700: '#363E71',
  ivory: '#FBF7EF',
  ivoryDim: '#F1EAD9',
  ivoryLine: '#E4DBC7',
  marigold: '#E8A33D',
  marigoldDeep: '#C97F1E',
  marigoldLight: '#F5C56E',
  teal: '#3E7C6A',
  tealDeep: '#2C5C4E',
  tealLight: '#5A9E8A',
  clay: '#C1502E',
  clayDeep: '#9C3D22',
  ink: '#1B1F3B',
  inkSoft: 'rgba(27,31,59,0.75)',
  inkFaint: 'rgba(27,31,59,0.58)',
  ringTrack: 'rgba(27,31,59,0.08)',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F8F4EC',
  overlay: 'rgba(23,27,54,0.52)',
  onDark: '#FBF7EF',
  onDarkMuted: 'rgba(251,247,239,0.75)',
  onDarkFaint: 'rgba(251,247,239,0.60)',
} as const;

export const Gradients = {
  hero: [Colors.indigo950, Colors.indigo900, '#252B52'] as const,
  heroAccent: ['rgba(232,163,61,0.18)', 'transparent'] as const,
  marigold: [Colors.marigoldLight, Colors.marigold] as const,
  cardShine: ['rgba(255,255,255,0.9)', Colors.white] as const,
} as const;

export const AccentHex = {
  clay: Colors.clay,
  teal: Colors.teal,
  marigold: Colors.marigold,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  full: 999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  lg: {
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 10,
  },
  fab: {
    shadowColor: Colors.marigold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  tabBar: {
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
} as const;

export const Typography = {
  displayLg: { fontFamily: 'Fraunces_700Bold', fontSize: 28, letterSpacing: -0.5, lineHeight: 34 },
  displayMd: { fontFamily: 'Fraunces_700Bold', fontSize: 24, letterSpacing: -0.3, lineHeight: 30 },
  displaySm: { fontFamily: 'Fraunces_600SemiBold', fontSize: 20, letterSpacing: -0.2, lineHeight: 26 },
  title: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, letterSpacing: -0.2, lineHeight: 22 },
  body: { fontFamily: 'Manrope_500Medium', fontSize: 14.5, lineHeight: 21 },
  bodySm: { fontFamily: 'Manrope_500Medium', fontSize: 13, lineHeight: 19 },
  label: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  caption: { fontFamily: 'Manrope_600SemiBold', fontSize: 11.5, lineHeight: 16 },
} as const;

export const Layout = {
  screenPadding: 20,
  headerHeight: 180,
  tabBarHeight: 72,
  contentOverlap: 24,
} as const;
