import { createError } from 'h3'
import { ofetch } from 'ofetch'

// GitHub API Client Configuration
export const githubApi = ofetch.create({
  onRequest({ options }) {
    const config = useRuntimeConfig()
    const token = config.githubToken
    const owner = config.githubOwner
    const repo = config.githubRepo

    if (!token || !owner || !repo) {
      throw createError({
        statusCode: 500,
        message: 'Server configuration error: Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO',
      })
    }

    options.baseURL = `https://api.github.com/repos/${owner}/${repo}`
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

// Vercel API Client Configuration
export const vercelApi = ofetch.create({
  onRequest({ options }) {
    const config = useRuntimeConfig()
    const token = config.projectToken
    const projectId = config.projectId
    const teamId = config.teamId

    if (!token || !projectId) {
      throw createError({
        statusCode: 500,
        message: 'Server configuration error: Missing PROJECT_TOKEN or PROJECT_ID',
      })
    }

    options.baseURL = 'https://api.vercel.com/v6'
    options.headers = {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    }

    // Automatically append projectId and teamId to all query parameters
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
    const errorMsg = response._data?.error?.message || response.statusText || 'Unknown Vercel API error'
    throw createError({
      statusCode: response.status,
      message: `Vercel API error: ${errorMsg}`,
    })
  },
})

// Jira API Client Configuration
export const jiraApi = ofetch.create({
  onRequest({ options }) {
    const config = useRuntimeConfig()
    const org = config.jiraOrg
    const email = config.jiraEmail
    const token = config.jiraApiToken

    if (!org || !email || !token) {
      throw createError({
        statusCode: 500,
        message: 'Server configuration error: Missing JIRA_ORG, JIRA_EMAIL, or JIRA_API_TOKEN',
      })
    }

    // Edge-compatible base64 encoding (replaces Node.js-only Buffer.from)
    const auth = btoa(`${email}:${token}`)

    options.baseURL = `https://${org}.atlassian.net/rest/api/3`
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
