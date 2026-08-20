const SEED_PATHS: Record<string, string[]> = {
  S01: ['M6 12Q20 34 34 12', 'M10 10Q20 18 30 10'],
  S02: ['M20 34V16', 'M20 20C8 17 8 8 18 7', 'M20 20C32 17 32 8 22 7'],
  S03: ['M20 4L17 14l6 6-7 6 4 10', 'M9 20h22'],
  S04: ['M5 20Q20 5 35 20Q20 35 5 20', 'M20 12v16'],
  S05: ['M5 18L20 6l15 12v17H8V21', 'M20 6v29'],
  S06: ['M5 14c12-9 26-7 29 3C37 29 20 35 9 28', 'M9 28l-1-9'],
  S07: ['M7 8h26l-5 25H12Z', 'M15 16h10l-2 9h-6Z'],
  S08: ['M6 20c8-12 20-12 28 0-8 12-20 12-28 0Z', 'M11 20h18', 'M20 12v16'],
  S09: ['M20 35V19', 'M20 22L8 12M20 22l12-10', 'M8 12l-3 7M32 12l3 7'],
  S10: ['M4 5v30h17', 'M28 8l8 12-8 12'],
  S11: ['M8 8l24 24M32 8L8 32', 'M4 20h10M26 20h10'],
  S12: ['M20 5L34 20 20 35 6 20Z', 'M13 20h14'],
  S13: ['M20 35V18M20 18L8 6M20 18L32 6', 'M8 6v8M32 6v8'],
  S14: ['M20 35V18M20 18L8 6M20 18L32 6', 'M27 4l9 9M28 13l8-9'],
  S15: ['M29 32A15 15 0 1 1 32 10', 'M32 10l-8 1M32 10l-2 8'],
  S16: ['M5 20h9M26 20h9', 'M20 5v9M20 26v9', 'M16 16l8 8M24 16l-8 8'],
}

export function SeedGlyph({ id }: { id: string }) {
  return <svg className="seed-glyph" viewBox="0 0 40 40" aria-hidden="true">
    {(SEED_PATHS[id] ?? SEED_PATHS.S16).map((path, index) => <path key={index} d={path} />)}
  </svg>
}
