import { defineEventHandler, getQuery, getRouterParam, createError } from 'h3'
import { createJiraApi } from '~~/server/utils/api'
import { getProjectById } from '~~/server/utils/projects'

export default defineEventHandler(async (event) => {
  const project = getProjectById(getRouterParam(event, 'projectId'))
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })
  if (!project.jira) {
    throw createError({ statusCode: 500, message: `Server configuration error: project "${project.id}" has no Jira configuration` })
  }

  const { key } = getQuery(event)
  if (!key) {
    throw createError({ statusCode: 400, message: 'Missing issue key' })
  }

  const fields = [
    'summary', 'status', 'issuetype', 'priority',
    'assignee', 'reporter', 'labels',
    'customfield_10016', // story points (classic)
    'customfield_10028', // story points (next-gen)
    'customfield_10020', // sprint
  ].join(',')

  const jiraApi = createJiraApi(project)
  const data = await jiraApi<any>(`/issue/${key}`, {
    query: { fields },
  })

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
    url: `https://${project.jira.org}.atlassian.net/browse/${data.key}`,
  }
})
