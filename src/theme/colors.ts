// Palette derived from the "Crossover Split" app icon.
// Usage convention: primary (night blue) = "you", secondary (day orange) = "partner".

export const colors = {
  primary: '#6A85F1',
  primaryLight: '#8FA8FF',
  primaryDark: '#4F63D1',
  // Scale runs dark -> light: Dark, base, Light, Soft, Tint.
  // Soft exists because Tint is only ~4% off `background` -- fine as a wash
  // behind something else, but a card filled with it reads as plain white.
  primarySoft: '#DDE4FF',
  primaryTint: '#EEF1FF',

  secondary: '#FFC670',
  secondaryLight: '#FFE0A3',
  secondaryDark: '#E6A94F',
  secondarySoft: '#FFEBC9',
  secondaryTint: '#FFF6E8',

  ink: '#2E2A3D',
  muted: '#6B6478',
  // Was #B8B2C4, which sat at 2.06:1 on surface and 1.87 on background --
  // below the 3:1 WCAG asks of a UI boundary. That matters most on Input,
  // where the border is the only thing saying where the field is.
  border: '#948BA6',
  background: '#F5F3FA',
  surface: '#FFFFFF',

  // Was #FF7A7A: 2.52:1 on white, so destructive text and the unwatched dot
  // both failed. Destructive copy is the last place to be hard to read.
  error: '#ED0000',
  success: '#5FC98A',
  warning: '#FFB74D',
} as const;

export const gradients = {
  // Hero moments (record button, distance card): blend of both partners.
  heroDayToNight: [colors.secondaryLight, colors.primary] as const,
  heroNightToDay: [colors.primaryLight, colors.secondary] as const,
};

export type ColorKey = keyof typeof colors;
