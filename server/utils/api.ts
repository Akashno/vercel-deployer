import { createError } from 'h3'
import { ofetch } from 'ofetch'
import type { Project } from './projects'

// GitHub API Client Factory — scoped to one project's repo/token
export function createGithubApi(project: Project) {
  if (!project.github) {
    throw createError({
      statusCode: 500,
      message: `Server configuration error: project "${project.id}" has no GitHub configuration`,
    })
  }
  const { token, owner, repo } = project.github

  return ofetch.create({
    baseURL: `https://api.github.com/repos/${owner}/${repo}`,
    onRequest({ options }) {
      options.headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {}),
      }
    },
    async onResponseError({ response }) {
      const errorMsg = response._data?.message || response.statusText || 'Unknown GitHub API error'
      throw createError({
        statusCode: response.status,
        message: `GitHub API error: ${errorMsg}`,
      })
    },
  })
}

// Vercel API Client Factory — scoped to one project's token/projectId/teamId.
// No fixed API version in baseURL — callers pass the versioned path (e.g. /v6/deployments).
export function createVercelApi(project: Project) {
  const { token, projectId, teamId } = project.vercel
  if (!token || !projectId) {
    throw createError({
      statusCode: 500,
      message: `Server configuration error: project "${project.id}" is missing a Vercel token or project ID`,
    })
  }

  return ofetch.create({
    baseURL: 'https://api.vercel.com',
    onRequest({ options }) {
      options.headers = {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      }

      const query: Record<string, any> = {
        projectId,
        ...(options.query || {}),
      }
      if (teamId) {
        query.teamId = teamId
      }
      options.query = query
    },
    async onResponseError({ response }) {
      const data = response._data
      const errorMsg = (typeof data === 'string' ? data : data?.error?.message) || response.statusText || 'Unknown Vercel API error'
      throw createError({
        statusCode: response.status,
        message: `Vercel API error: ${errorMsg}`,
      })
    },
  })
}

// Jira API Client Factory — scoped to one project's org/email/token
export function createJiraApi(project: Project) {
  if (!project.jira) {
    throw createError({
      statusCode: 500,
      message: `Server configuration error: project "${project.id}" has no Jira configuration`,
    })
  }
  const { org, email, apiToken } = project.jira

  // Edge-compatible base64 encoding (replaces Node.js-only Buffer.from)
  const auth = btoa(`${email}:${apiToken}`)

  return ofetch.create({
    baseURL: `https://${org}.atlassian.net/rest/api/3`,
    onRequest({ options }) {
      options.headers = {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        ...(options.headers || {}),
      }
    },
    async onResponseError({ response }) {
      const errorMessages = response._data?.errorMessages || []
      const errors = response._data?.errors || {}
      const detail = errorMessages.join(', ') || Object.values(errors).join(', ') || ''
      const errorMsg = detail || response.statusText || 'Unknown Jira API error'

      throw createError({
        statusCode: response.status,
        message: `Jira API error: ${errorMsg}`,
      })
    },
  })
}
