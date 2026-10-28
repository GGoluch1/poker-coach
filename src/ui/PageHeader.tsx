import type { ReactNode } from 'react'
import type { Crumb } from './routes'

interface Props {
  title: ReactNode
  /** Pages above this one, outermost first. */
  crumbs?: Crumb[]
  /** Controls shown beside the title. */
  actions?: ReactNode
  /** A tighter header for pages where the content needs the room. */
  compact?: boolean
  children?: ReactNode
}

export function PageHeader({ title, crumbs, actions, compact, children }: Props) {
  return (
    <header className={`page-header${compact ? ' page-header-compact' : ''}`}>
      {crumbs && (
        <nav className="crumbs" aria-label="Breadcrumb">
          <ol>
            {crumbs.map((c) => (
              <li key={c.label}>{c.href ? <a href={c.href}>{c.label}</a> : c.label}</li>
            ))}
          </ol>
        </nav>
      )}
      <div className="page-header-row">
        <div className="page-header-text">
          <h1 className="page-title" tabIndex={-1}>
            {title}
          </h1>
          {children && <div className="page-lede">{children}</div>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </header>
  )
}
