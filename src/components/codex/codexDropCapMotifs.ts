export type DropCapMotif = 'water' | 'path' | 'seed' | 'eye' | 'cord' | 'scar' | 'door' | 'star' | 'open-circle'

export const DROP_CAP_MOTIFS: DropCapMotif[] = ['water', 'path', 'seed', 'eye', 'cord', 'scar', 'door', 'star', 'open-circle']

export const DROP_CAP_PATHS: Record<DropCapMotif, string[]> = {
  water: ['M6 56Q26 42 46 56T86 56', 'M12 67Q30 55 48 67T82 67'],
  path: ['M12 82C30 65 18 43 48 30S70 14 84 8', 'M29 75C42 56 36 45 58 36'],
  seed: ['M48 77V28', 'M48 49C30 48 24 33 27 20C42 22 49 32 48 49', 'M48 58C63 57 72 44 70 33C57 34 49 43 48 58'],
  eye: ['M9 48Q48 13 87 48Q48 83 9 48Z', 'M48 34A14 14 0 1 0 48 62A14 14 0 1 0 48 34'],
  cord: ['M15 18C75 20 25 76 82 78', 'M20 13C80 15 30 72 87 73'],
  scar: ['M12 75L82 18', 'M26 70l-7-8M39 59l-7-8M54 47l-7-8M69 35l-7-8'],
  door: ['M20 80V18H76V80', 'M33 80V34Q48 20 63 34V80'],
  star: ['M48 9L55 38L84 48L55 56L48 86L40 56L11 48L40 38Z'],
  'open-circle': ['M72 75A36 36 0 1 1 76 24', 'M70 16l13 6-7 12'],
}
