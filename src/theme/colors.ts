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
  border: '#B8B2C4',
  background: '#F5F3FA',
  surface: '#FFFFFF',

  error: '#FF7A7A',
  success: '#5FC98A',
  warning: '#FFB74D',
} as const;

export const gradients = {
  // Hero moments (record button, distance card): blend of both partners.
  heroDayToNight: [colors.secondaryLight, colors.primary] as const,
  heroNightToDay: [colors.primaryLight, colors.secondary] as const,
};

export type ColorKey = keyof typeof colors;
