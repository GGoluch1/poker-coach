import type { CSSProperties } from 'react'
import type { GameState } from '../engine/game'
import { blindSeats, totalPot } from '../engine/game'
import { describeHand, evaluateHand } from '../engine/hand'
import type { Personality } from '../engine/profiles'
import { PROFILES } from '../engine/profiles'
import type { PlayStats } from '../engine/stats'
import { positions } from '../engine/range'
import { CardView } from './CardView'
import { HERO } from './useGame'

/** Avatar hues, one per seat. */
const SEAT_HUES = [152, 210, 28, 280, 340, 190]
const ACTION_LABEL = { fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise' }

interface Props {
  game: GameState
  profiles?: (Personality | undefined)[]
  /** Per-seat stats, shown as VPIP/PFR on each opponent. */
  seatStats?: PlayStats[]
  /** Replay mode: no result banner. */
  replay?: boolean
}

export function Table({ game, profiles = [], seatStats, replay = false }: Props) {
  const n = game.players.length
  const pos = positions(
    game.players.map((p) => p.inHand),
    game.button,
  )
  const winnings = new Map<number, number>()
  for (const e of game.events) {
    if (e.type === 'win') winnings.set(e.seat, (winnings.get(e.seat) ?? 0) + e.amount)
  }
  const lastAction = (seat: number) => {
    for (let i = game.events.length - 1; i >= 0; i--) {
      const e = game.events[i]
      if (e.type === 'deal' && !game.handOver) return null
      if (e.type === 'action' && e.seat === seat) {
        return (
          ACTION_LABEL[e.action] + (e.action === 'bet' || e.action === 'raise' ? ` ${e.to}` : '')
        )
      }
    }
    return null
  }
  const { bb } = game.handNumber > 0 ? blindSeats(game) : { bb: -1 }
  const pot = totalPot(game)

  return (
    <div className="table-wrap">
      <div className="felt">
        <div className="felt-center">
          <div className="board">
            {[0, 1, 2, 3, 4].map((i) => (
              <CardView key={i} card={game.board[i]} size="lg" />
            ))}
          </div>
          <div className="pot">
            Pot <strong>{pot}</strong>
          </div>
          {game.handOver && !replay && (
            <div className="result">
              <ResultLine game={game} />
            </div>
          )}
        </div>

        {game.players.map((p, seat) => {
          // Hero at the bottom, then clockwise.
          const angle = Math.PI / 2 + (seat * 2 * Math.PI) / n
          const x = 50 + 44 * Math.cos(angle)
          const y = 50 + 41 * Math.sin(angle)
          const isHero = seat === HERO
          const live = p.inHand && !p.folded
          const reveal = isHero || (game.showdown && live)
          const won = winnings.get(seat)
          const action = lastAction(seat)
          const classes = [
            'seat',
            isHero && 'seat-hero',
            game.toAct === seat && 'seat-active',
            !live && 'seat-out',
            won && 'seat-won',
          ]
          return (
            <div
              key={seat}
              className={classes.filter(Boolean).join(' ')}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="seat-cards">
                {p.inHand &&
                  p.hole.map((c, i) => (
                    <CardView key={i} card={c} size="md" hidden={!reveal} dim={p.folded} />
                  ))}
              </div>
              <div
                className="seat-avatar"
                style={{ '--hue': SEAT_HUES[seat % SEAT_HUES.length] } as CSSProperties}
              >
                {isHero ? 'You' : p.name[0]}
                {pos[seat] && <span className="seat-pos">{pos[seat]}</span>}
              </div>
              <div className="seat-plate">
                {!isHero && <div className="seat-name">{p.name}</div>}
                <div className="seat-stack">{p.inHand || p.stack > 0 ? p.stack : 'Out'}</div>
                {profiles[seat] && (
                  <div className="seat-profile" title={PROFILES[profiles[seat]].description}>
                    {PROFILES[profiles[seat]].short}
                    {seatStats && seatStats[seat].hands > 0 && (
                      <span
                        className="hud"
                        title={`VPIP / PFR over ${seatStats[seat].hands} hands`}
                      >
                        {' '}
                        {Math.round((seatStats[seat].vpip / seatStats[seat].hands) * 100)}/
                        {Math.round((seatStats[seat].pfr / seatStats[seat].hands) * 100)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {won ? (
                <div className="seat-badge badge-win">Wins {won}</div>
              ) : p.allIn ? (
                <div className="seat-badge badge-allin">All in</div>
              ) : p.folded && p.inHand ? (
                <div className="seat-badge badge-fold">Folded</div>
              ) : action ? (
                <div className="seat-badge">{action}</div>
              ) : null}
              {game.showdown && live && !isHero && game.board.length === 5 && (
                <div className="seat-hand">{describeShown(game, seat)}</div>
              )}
              {seat === game.button && (
                <span className="dealer" title="Dealer button">
                  D
                </span>
              )}
              {p.bet > 0 && (
                // Offset toward the middle of the table.
                <div
                  className="bet"
                  style={{ '--dx': -Math.cos(angle), '--dy': -Math.sin(angle) } as CSSProperties}
                >
                  <span className="chip" aria-hidden />
                  {p.bet}
                  {seat === bb && game.street === 'preflop' && p.bet === game.bigBlind && (
                    <span className="muted"> BB</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function describeShown(game: GameState, seat: number): string {
  return describeHand(evaluateHand([...game.players[seat].hole, ...game.board]))
}

function ResultLine({ game }: { game: GameState }) {
  const wins = game.events.filter((e) => e.type === 'win')
  const bySeat = new Map<number, { amount: number; hand: string | null }>()
  for (const e of wins) {
    if (e.type !== 'win') continue
    const prev = bySeat.get(e.seat)
    bySeat.set(e.seat, {
      amount: (prev?.amount ?? 0) + e.amount,
      hand: e.hand ? describeHand(e.hand) : (prev?.hand ?? null),
    })
  }
  return (
    <div className="result-line">
      {[...bySeat].map(([seat, w]) => (
        <div key={seat}>
          <strong>{seat === HERO ? 'You win' : `${game.players[seat].name} wins`}</strong>{' '}
          {w.amount}
          {w.hand && <> with {w.hand}</>}
        </div>
      ))}
    </div>
  )
}
