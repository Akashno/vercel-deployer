export default defineEventHandler(async () => {
  const token = process.env.PROJECT_TOKEN
  const projectId = process.env.PROJECT_ID
  const teamId = process.env.TEAM_ID

  if (!token || !projectId) {
    throw createError({ statusCode: 500, message: 'Missing PROJECT_TOKEN or PROJECT_ID env vars' })
  }

  const url = new URL(`https://api.vercel.com/v9/projects/${projectId}`)
  if (teamId) url.searchParams.set('teamId', teamId)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw createError({ statusCode: res.status, message: `Vercel API error: ${res.statusText}. ${body}` })
  }

  const data = await res.json()
  return { name: data.name as string }
})
