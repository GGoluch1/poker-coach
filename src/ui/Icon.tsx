/** Stroke icons on a 24px grid; they inherit the current text color. */
const PATHS = {
  spade: [
    'M12 2 5 9c-1.5 1.5-3 3.2-3 5.5A5.5 5.5 0 0 0 7.5 20c1.8 0 3-.5 4.5-2 1.5 1.5 2.7 2 4.5 2a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.5-4-3-5.5Z',
    'M12 18v4',
  ],
  bolt: ['M13 2 3 14h9l-1 8 10-12h-9l1-8Z'],
  layers: ['M12 2 2 7l10 5 10-5-10-5Z', 'm2 17 10 5 10-5', 'm2 12 10 5 10-5'],
  cpu: [
    'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    'M9 9h6v6H9Z',
    'M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3',
  ],
  chart: ['M3 3v18h18', 'M8 17v-6M13 17V7M18 17v-3'],
  target: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
    'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  ],
  timer: ['M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'M12 9v4l2 2', 'M9 2h6'],
  grid: [
    'M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z',
    'M15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z',
    'M4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z',
    'M15 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z',
  ],
  waves: [
    'M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5s2.4 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1',
    'M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.4 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1',
    'M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.4 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1',
  ],
  percent: [
    'M19 5 5 19',
    'M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    'M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  ],
  cards: [
    'M5 6h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z',
    'M9 3h10a2 2 0 0 1 2 2v12',
  ],
  gem: ['M6 3h12l4 6-10 13L2 9Z', 'M2 9h20', 'm12 22 4-13-3-6M12 22 8 9l3-6'],
  repeat: [
    'm17 2 4 4-4 4',
    'M3 11v-1a4 4 0 0 1 4-4h14',
    'm7 22-4-4 4-4',
    'M21 13v1a4 4 0 0 1-4 4H3',
  ],
  chevronLeft: ['m15 18-6-6 6-6'],
  chevronRight: ['m9 18 6-6-6-6'],
  chevronDown: ['m6 9 6 6 6-6'],
  arrowRight: ['M5 12h14', 'm13 6 6 6-6 6'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  sun: [
    'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  ],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z'],
  book: ['M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20'],
  play: ['M7 4v16l13-8Z'],
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
