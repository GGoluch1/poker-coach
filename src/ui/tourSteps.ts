const SEEN_KEY = 'poker-coach:tour:v1'

export interface TourStep {
  /** CSS selector for the part of the page this step points at. */
  target: string
  title: string
  body: string
}

export const PLAY_TOUR: TourStep[] = [
  {
    target: '.felt',
    title: 'Your table',
    body: 'You sit at the bottom. Each bot shows its style (nit, maniac, calling station or balanced) and its VPIP and PFR: how often it plays a hand and how often it raises.',
  },
  {
    target: '.action-bar',
    title: 'Your decisions',
    body: 'When it’s your turn, fold, check, call or raise here. On a keyboard, F, C and R work too.',
  },
  {
    target: '.sidebar',
    title: 'The coach',
    body: 'Live equity, pot odds, outs and chart advice for every decision. Turn off Live hints in the table settings when you want to test yourself.',
  },
  {
    target: '.sidebar',
    title: 'A review after every hand',
    body: 'When a hand ends, each decision gets a grade and a rough EV for every option. Mistakes go into your review deck under Drills.',
  },
]

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== null
  } catch {
    return true
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // It shows again next visit; harmless.
  }
}
