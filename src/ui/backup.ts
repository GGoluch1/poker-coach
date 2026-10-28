/** Everything the app saves uses this prefix: progress, the current game, imported hands, theme. */
const PREFIX = 'poker-coach:'

export interface Backup {
  app: 'poker-coach'
  version: 1
  exportedAt: string
  data: Record<string, string>
}

/** Downloads every saved value as one JSON file. */
export function exportBackup() {
  const data = Object.fromEntries(savedKeys().map((k) => [k, localStorage.getItem(k)!]))
  const backup: Backup = {
    app: 'poker-coach',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `poker-coach-backup-${backup.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Reads and checks a backup file, throwing a readable error if it isn't one. */
export async function readBackup(file: File): Promise<Backup> {
  let backup: Partial<Backup>
  try {
    backup = JSON.parse(await file.text())
  } catch {
    throw new Error('That file isn’t a Poker Coach backup.')
  }
  const entries = Object.entries(backup.data ?? {})
  if (
    backup.app !== 'poker-coach' ||
    entries.length === 0 ||
    entries.some(([k, v]) => !k.startsWith(PREFIX) || typeof v !== 'string')
  ) {
    throw new Error('That file isn’t a Poker Coach backup.')
  }
  return backup as Backup
}

/** Replaces every saved value with the backup's. Reload the page afterwards to pick them up. */
export function restoreBackup(backup: Backup) {
  for (const key of savedKeys()) localStorage.removeItem(key)
  for (const [key, value] of Object.entries(backup.data)) localStorage.setItem(key, value)
}

function savedKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) keys.push(key)
  }
  return keys
}
