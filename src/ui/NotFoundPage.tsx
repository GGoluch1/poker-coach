import { PageHeader } from './PageHeader'
import { href } from './routes'

export function NotFoundPage() {
  return (
    <div className="page">
      <PageHeader title="Page not found">
        That link doesn’t match any page. It may be mistyped or from an older version of the app.
      </PageHeader>
      <div className="button-row">
        <a className="btn btn-primary" href={href({ page: 'home' })}>
          Go home
        </a>
        <a className="btn" href={href({ page: 'play' })}>
          Play a hand
        </a>
      </div>
    </div>
  )
}
