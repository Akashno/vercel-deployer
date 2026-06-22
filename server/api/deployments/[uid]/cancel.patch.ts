export default defineEventHandler(async (event) => {
  const uid = getRouterParam(event, 'uid')
  const token = process.env.PROJECT_TOKEN
  const teamId = process.env.TEAM_ID

  if (!token) {
    throw createError({ statusCode: 500, message: 'Missing PROJECT_TOKEN env var' })
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
