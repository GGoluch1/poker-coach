import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { IconName } from './Icon'
import { Icon } from './Icon'
import type { Route, Section } from './routes'
import { href, sameRoute, sectionOf } from './routes'
import type { Hue } from './siteMap'
import { DRILLS, PRACTICE_DRILLS, STUDY_TOOLS } from './siteMap'
import { setTheme, useTheme } from './theme'

type MenuName = 'drills' | 'study'

export function Logo() {
  return (
    <a className="brand" href={href({ page: 'home' })} aria-label="Poker Coach home">
      <span className="brand-mark" aria-hidden>
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="currentColor"
            d="M12 2.5c-2.6 3.8-7.5 6.2-7.5 10.3 0 2.5 1.9 4.2 4.2 4.2 1.1 0 2-.3 2.7-1-.2 1.9-1 3-2.3 3.8v.7h5.8v-.7c-1.3-.8-2.1-1.9-2.3-3.8.7.7 1.6 1 2.7 1 2.3 0 4.2-1.7 4.2-4.2 0-4.1-4.9-6.5-7.5-10.3Z"
          />
        </svg>
      </span>
      <span className="brand-name">Poker Coach</span>
    </a>
  )
}

export function ThemeToggle() {
  const theme = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      className="btn btn-quiet btn-icon"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  )
}

/** A link that marks itself as the current page. */
function NavLink({
  to,
  route,
  className,
  children,
}: {
  to: Route
  route: Route
  className?: string
  children: ReactNode
}) {
  const current = sameRoute(to, route)
  return (
    <a
      href={href(to)}
      className={`${className ?? ''}${current ? ' is-current' : ''}`}
      aria-current={current ? 'page' : undefined}
    >
      {children}
    </a>
  )
}

function Dropdown({
  name,
  label,
  active,
  open,
  setOpen,
  children,
}: {
  name: MenuName
  label: string
  active: boolean
  open: boolean
  setOpen: (name: MenuName | null) => void
  children: ReactNode
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const links = () => [...(panelRef.current?.querySelectorAll<HTMLAnchorElement>('a') ?? [])]

  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(name)
      requestAnimationFrame(() => links()[0]?.focus())
    } else if (e.key === 'Escape' && open) {
      setOpen(null)
    }
  }

  const onPanelKey = (e: KeyboardEvent) => {
    const list = links()
    const i = list.indexOf(document.activeElement as HTMLAnchorElement)
    const focus = (j: number) => {
      e.preventDefault()
      list[(j + list.length) % list.length]?.focus()
    }
    if (e.key === 'ArrowDown') focus(i + 1)
    else if (e.key === 'ArrowUp') focus(i - 1)
    else if (e.key === 'Home') focus(0)
    else if (e.key === 'End') focus(list.length - 1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(null)
      buttonRef.current?.focus()
    }
  }

  return (
    <li
      className="nav-menu"
      onBlur={(e) => {
        // Close when Tab moves focus out of the menu. Clicks outside are handled by the header.
        const to = e.relatedTarget as Node | null
        if (open && to && !e.currentTarget.contains(to)) setOpen(null)
      }}
    >
      <button
        ref={buttonRef}
        className={`nav-link${active ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-controls={`menu-${name}`}
        onClick={() => setOpen(open ? null : name)}
        onKeyDown={onButtonKey}
      >
        {label}
        <Icon name="chevronDown" size={16} />
      </button>
      <div
        ref={panelRef}
        id={`menu-${name}`}
        className={`menu-panel menu-${name}`}
        hidden={!open}
        onKeyDown={onPanelKey}
      >
        {children}
      </div>
    </li>
  )
}

function MenuItem({
  to,
  route,
  title,
  short,
  icon,
  hue,
  badge,
}: {
  to: Route
  route: Route
  title: string
  short: string
  icon: IconName
  hue: Hue
  badge?: number
}) {
  return (
    <NavLink to={to} route={route} className="menu-item">
      <span className={`tile tile-sm hue-${hue}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="menu-text">
        <span className="menu-title">
          {title}
          {badge ? <span className="badge">{badge}</span> : null}
        </span>
        <span className="menu-short">{short}</span>
      </span>
    </NavLink>
  )
}

export function SiteHeader({ route, due }: { route: Route; due: number }) {
  const [open, setOpen] = useState<MenuName | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const section = sectionOf(route)
  const review = DRILLS.find((d) => d.id === 'review')!

  // Close an open dropdown on a click outside the header or Escape anywhere.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // The mobile menu covers the page: stop it scrolling, and close on Escape or a wide window.
  useEffect(() => {
    if (!mobileOpen) return
    const wide = window.matchMedia('(min-width: 901px)')
    const close = () => setMobileOpen(false)
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && close()
    document.body.classList.add('no-scroll')
    document.addEventListener('keydown', onKey)
    wide.addEventListener('change', close)
    return () => {
      document.body.classList.remove('no-scroll')
      document.removeEventListener('keydown', onKey)
      wide.removeEventListener('change', close)
    }
  }, [mobileOpen])

  // Following any link closes the menus, even a link to the page already open.
  const closeOnLink = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) {
      setOpen(null)
      setMobileOpen(false)
    }
  }

  const isActive = (s: Section) => section === s

  return (
    <header className="site-header" ref={headerRef} onClick={closeOnLink}>
      <div className="site-header-inner">
        <Logo />

        <nav className="nav-desktop" aria-label="Main">
          <ul className="nav-list">
            <li>
              <NavLink to={{ page: 'play' }} route={route} className="nav-link">
                Play
              </NavLink>
            </li>
            <Dropdown
              name="drills"
              label="Drills"
              active={isActive('drills')}
              open={open === 'drills'}
              setOpen={setOpen}
            >
              <div className="menu-grid">
                {PRACTICE_DRILLS.map((d) => (
                  <MenuItem
                    key={d.id}
                    to={{ page: 'drills', drill: d.id }}
                    route={route}
                    title={d.title}
                    short={d.short}
                    icon={d.icon}
                    hue={d.hue}
                  />
                ))}
                <MenuItem
                  to={{ page: 'drills', drill: 'review' }}
                  route={route}
                  title={review.title}
                  short={review.short}
                  icon={review.icon}
                  hue={review.hue}
                  badge={due}
                />
              </div>
              <div className="menu-foot">
                <a href={href({ page: 'drills', drill: null })} className="menu-foot-link">
                  All drills and your scores <Icon name="arrowRight" size={16} />
                </a>
              </div>
            </Dropdown>
            <Dropdown
              name="study"
              label="Study"
              active={isActive('study')}
              open={open === 'study'}
              setOpen={setOpen}
            >
              {STUDY_TOOLS.map((t) => (
                <MenuItem
                  key={t.title}
                  to={t.route}
                  route={route}
                  title={t.title}
                  short={t.short}
                  icon={t.icon}
                  hue={t.hue}
                />
              ))}
            </Dropdown>
            <li>
              <NavLink to={{ page: 'progress' }} route={route} className="nav-link">
                Progress
              </NavLink>
            </li>
          </ul>
        </nav>

        <div className="header-actions">
          {due > 0 && (
            <a
              className="due-pill"
              href={href({ page: 'drills', drill: 'review' })}
              title={`${due} missed spot${due === 1 ? '' : 's'} due for review`}
            >
              <Icon name="repeat" size={16} />
              {due} due
            </a>
          )}
          <ThemeToggle />
          <button
            className="btn btn-quiet btn-icon nav-toggle"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Icon name={mobileOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>

      <nav id="mobile-menu" className="nav-mobile" aria-label="Main" hidden={!mobileOpen}>
        <ul className="mobile-list">
          <li>
            <NavLink to={{ page: 'home' }} route={route} className="mobile-link">
              Home
            </NavLink>
          </li>
          <li>
            <NavLink to={{ page: 'play' }} route={route} className="mobile-link">
              Play
            </NavLink>
          </li>
          <li>
            <NavLink to={{ page: 'progress' }} route={route} className="mobile-link">
              Progress
            </NavLink>
          </li>
        </ul>
        <h2 className="mobile-heading">
          <a href={href({ page: 'drills', drill: null })}>Drills</a>
        </h2>
        <ul className="mobile-list">
          {DRILLS.map((d) => (
            <li key={d.id}>
              <NavLink
                to={{ page: 'drills', drill: d.id }}
                route={route}
                className="mobile-link mobile-sub"
              >
                <span className={`tile tile-xs hue-${d.hue}`}>
                  <Icon name={d.icon} size={15} />
                </span>
                {d.title}
                {d.id === 'review' && due > 0 && <span className="badge">{due}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
        <h2 className="mobile-heading">Study</h2>
        <ul className="mobile-list">
          {STUDY_TOOLS.map((t) => (
            <li key={t.title}>
              <NavLink to={t.route} route={route} className="mobile-link mobile-sub">
                <span className={`tile tile-xs hue-${t.hue}`}>
                  <Icon name={t.icon} size={15} />
                </span>
                {t.title}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
