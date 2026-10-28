import { Icon } from './Icon'
import { PageHeader } from './PageHeader'
import { RangeChart } from './RangeChart'
import { HOME_CRUMB, href } from './routes'

export function ChartsPage() {
  return (
    <div className="page">
      <PageHeader title="Preflop charts" crumbs={[HOME_CRUMB, { label: 'Study' }]}>
        Approximate 6-max ranges at 100 big blinds for every preflop spot the coach and drills use.
      </PageHeader>

      <div className="charts-layout">
        <section className="card-panel">
          <RangeChart current={null} />
        </section>
        <aside className="card-panel prose">
          <h2>How to read a chart</h2>
          <p>
            Each square is a starting hand. Pairs run down the diagonal, suited hands sit above it
            and offsuit hands below.
          </p>
          <h2>The three situations</h2>
          <dl>
            <dt>Open</dt>
            <dd>Everyone before you folded. Raise the colored hands, fold the rest.</dd>
            <dt>vs open</dt>
            <dd>Someone raised before you. Three-bet, call or fold.</dd>
            <dt>vs 3-bet</dt>
            <dd>You opened and got re-raised. Four-bet, call or fold.</dd>
          </dl>
          <p className="muted small">
            Real ranges shift with stack depth, opponents and rake. Treat these as a solid default,
            not the last word.
          </p>
          <a className="btn btn-primary" href={href({ page: 'drills', drill: 'preflop' })}>
            Practice preflop <Icon name="arrowRight" size={16} />
          </a>
        </aside>
      </div>
    </div>
  )
}
