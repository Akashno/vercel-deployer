import { defineEventHandler, getQuery, createError } from 'h3'
import { vercelApi } from '~~/server/utils/api'

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
  const { branch, sha, since } = getQuery(event) as { branch?: string; sha?: string; since?: string }
  if (!branch) {
    throw createError({ statusCode: 400, message: 'Branch name is required' })
  }

  const config = useRuntimeConfig()
  const owner = config.githubOwner
  const repo = config.githubRepo

  // Fetch recent deployments for the project using the shared vercelApi client
  // projectId and teamId are automatically appended by the client's interceptor!
  const data = await vercelApi<VercelDeploymentsResponse>('/deployments', {
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
