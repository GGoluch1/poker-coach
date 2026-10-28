import { href } from './routes'
import { DRILLS, STUDY_TOOLS } from './siteMap'
import { Logo, ThemeToggle } from './SiteHeader'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-about">
          <Logo />
          <p>
            Learn no-limit hold’em by playing against bots, with a coach that explains every
            decision.
          </p>
          <ThemeToggle />
        </div>
        <nav className="footer-links" aria-label="Footer">
          <div>
            <h2>Play</h2>
            <ul>
              <li>
                <a href={href({ page: 'play' })}>Play a game</a>
              </li>
              <li>
                <a href={href({ page: 'progress' })}>Progress</a>
              </li>
            </ul>
          </div>
          <div>
            <h2>Drills</h2>
            <ul>
              {DRILLS.map((d) => (
                <li key={d.id}>
                  <a href={href({ page: 'drills', drill: d.id })}>{d.title}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Study</h2>
            <ul>
              {STUDY_TOOLS.map((t) => (
                <li key={t.title}>
                  <a href={href(t.route)}>{t.title}</a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
      <div className="site-footer-inner footer-fine">
        <p>Everything runs in your browser. Your games and progress are saved on this device.</p>
        <p>
          Postflop advice is heuristic and EVs are rough; only the river solver computes game-theory
          strategy.
        </p>
      </div>
    </footer>
  )
}
