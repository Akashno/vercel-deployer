interface LogEvent {
  type: string
  payload?: { text?: string; date?: number }
}

export default defineEventHandler(async (event) => {
  const uid = getRouterParam(event, 'uid')
  const config = useRuntimeConfig()
  const token = config.projectToken
  const teamId = config.teamId

  if (!token) {
    throw createError({ statusCode: 500, message: 'Missing PROJECT_TOKEN configuration' })
  }

  const url = new URL(`https://api.vercel.com/v2/deployments/${uid}/events`)
  url.searchParams.set('direction', 'forward')
  if (teamId) url.searchParams.set('teamId', teamId)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw createError({ statusCode: res.status, message: `Vercel API error: ${res.statusText}. ${body}` })
  }

  const text = await res.text()

  let events: LogEvent[] = []
  try {
    const parsed = JSON.parse(text)
    events = Array.isArray(parsed) ? parsed : []
  } catch {
    events = text
      .split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line) } catch { return null } })
      .filter(Boolean) as LogEvent[]
  }

  return events
    .filter(e => e.type === 'stdout' || e.type === 'stderr' || e.type === 'command')
    .map(e => ({
      type: e.type,
      text: e.payload?.text ?? '',
      date: e.payload?.date ?? null,
    }))
})
