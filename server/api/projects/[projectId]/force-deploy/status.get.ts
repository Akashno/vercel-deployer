import { defineEventHandler, getQuery, getRouterParam, createError } from 'h3'
import { createVercelApi } from '~~/server/utils/api'
import { getProjectById } from '~~/server/utils/projects'
import { validateBranch, validateSha } from '~~/server/utils/validation'

interface VercelDeploymentMeta {
  githubCommitRef?: string
  gitlabCommitRef?: string
  bitbucketCommitRef?: string
  githubCommitSha?: string
  gitlabCommitSha?: string
  bitbucketCommitSha?: string
}

interface VercelDeployment {
  uid: string
  state?: string
  readyState?: string
  inspectorUrl?: string
  createdAt?: number
  created?: number
  meta?: VercelDeploymentMeta
}

interface VercelDeploymentsResponse {
  deployments: VercelDeployment[]
}

export default defineEventHandler(async (event) => {
  const project = getProjectById(getRouterParam(event, 'projectId'))
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })

  const { branch, sha, since } = getQuery(event) as { branch?: string; sha?: string; since?: string }
  validateBranch(branch)
  validateSha(sha)
  if (since && !/^\d+$/.test(since)) {
    throw createError({ statusCode: 400, message: 'Invalid since timestamp format' })
  }

  const owner = project.github?.owner
  const repo = project.github?.repo

  const vercelApi = createVercelApi(project)
  const data = await vercelApi<VercelDeploymentsResponse>('/v6/deployments', {
    query: { limit: '20' },
  })

  const sinceMs = since ? parseInt(since, 10) : 0
  const commitLink = owner && repo && sha
    ? `https://github.com/${owner}/${repo}/commit/${sha}`
    : ''

  // Find the deployment that matches the branch and our newly pushed commit SHA
  const deployment = data.deployments.find((d) => {
    const meta = d.meta ?? {}
    const dBranch = meta.githubCommitRef ?? meta.gitlabCommitRef ?? meta.bitbucketCommitRef ?? null
    const dSha = meta.githubCommitSha ?? meta.gitlabCommitSha ?? meta.bitbucketCommitSha ?? null

    if (dBranch !== branch) return false

    if (sha) {
      return dSha === sha
    } else {
      const created = d.createdAt ?? d.created ?? 0
      return created >= sinceMs - 30_000
    }
  })

  if (!deployment) {
    // Vercel has not picked it up yet
    return {
      id: sha || 'pending',
      status: 'queued',
      conclusion: null,
      html_url: commitLink,
    }
  }

  // Map Vercel deployment state (QUEUED, BUILDING, READY, ERROR, CANCELED) to standard tracking statuses
  const state = (deployment.readyState ?? deployment.state ?? 'QUEUED').toUpperCase()
  let status = 'in_progress'
  let conclusion: string | null = null

  if (state === 'READY') {
    status = 'completed'
    conclusion = 'success'
  } else if (state === 'ERROR' || state === 'CANCELED') {
    status = 'completed'
    conclusion = 'failure'
  }

  return {
    id: deployment.uid,
    status,
    conclusion,
    html_url: deployment.inspectorUrl ? `https://${deployment.inspectorUrl}` : commitLink,
    created_at: deployment.createdAt ?? deployment.created ?? null,
  }
})
