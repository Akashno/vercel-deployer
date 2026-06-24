export default defineEventHandler(async (event) => {
  const { key } = getQuery(event)

  const org = process.env.JIRA_ORG
  const email = process.env.JIRA_EMAIL
  const token = process.env.JIRA_API_TOKEN

  if (!org || !email || !token) {
    throw createError({ statusCode: 500, message: 'Missing JIRA_ORG, JIRA_EMAIL or JIRA_API_TOKEN' })
  }
  if (!key) {
    throw createError({ statusCode: 400, message: 'Missing issue key' })
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64')
  const fields = [
    'summary', 'status', 'issuetype', 'priority',
    'assignee', 'reporter', 'labels',
    'customfield_10016', // story points (classic)
    'customfield_10028', // story points (next-gen)
    'customfield_10020', // sprint
  ].join(',')

  const res = await fetch(
    `https://${org}.atlassian.net/rest/api/3/issue/${key}?fields=${fields}`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    },
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw createError({ statusCode: res.status, message: `Jira API error: ${res.statusText}. ${body}` })
  }

  const data = await res.json()
  const f = data.fields

  const sprint = (f.customfield_10020 as any[])?.[0]?.name ?? null
  const storyPoints = (f.customfield_10016 ?? f.customfield_10028 ?? null) as number | null

  return {
    key: data.key as string,
    summary: (f.summary ?? '') as string,
    status: (f.status?.name ?? null) as string | null,
    statusCategory: (f.status?.statusCategory?.key ?? null) as string | null,
    type: (f.issuetype?.name ?? null) as string | null,
    priority: (f.priority?.name ?? null) as string | null,
    assignee: f.assignee
      ? { name: f.assignee.displayName as string, avatar: (f.assignee.avatarUrls?.['24x24'] ?? null) as string | null }
      : null,
    reporter: (f.reporter?.displayName ?? null) as string | null,
    labels: (f.labels ?? []) as string[],
    sprint,
    storyPoints,
    url: `https://${org}.atlassian.net/browse/${data.key}`,
  }
})
