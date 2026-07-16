import { defineEventHandler, getRouterParam, createError } from 'h3'
import { createVercelApi } from '~~/server/utils/api'
import { getProjectById } from '~~/server/utils/projects'
import { validateUid } from '~~/server/utils/validation'

interface LogEvent {
  type: string
  payload?: { text?: string; date?: number }
}

export default defineEventHandler(async (event) => {
  const project = getProjectById(getRouterParam(event, 'projectId'))
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })

  const uid = getRouterParam(event, 'uid')
  validateUid(uid)

  const vercelApi = createVercelApi(project)
  const text = await vercelApi<string>(`/v2/deployments/${uid}/events`, {
    query: { direction: 'forward' },
    responseType: 'text',
  })

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
