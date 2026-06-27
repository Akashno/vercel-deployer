import { validateUid } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const uid = getRouterParam(event, 'uid')
  validateUid(uid)
  const config = useRuntimeConfig()
  const token = config.projectToken
  const teamId = config.teamId

  if (!token) {
    throw createError({ statusCode: 500, message: 'Missing PROJECT_TOKEN configuration' })
  }

  const url = new URL(`https://api.vercel.com/v12/deployments/${uid}/cancel`)
  if (teamId) url.searchParams.set('teamId', teamId)

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw createError({ statusCode: res.status, message: `Vercel API error: ${res.statusText}. ${body}` })
  }

  return { ok: true }
})
