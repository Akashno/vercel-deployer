import { defineEventHandler, getQuery } from 'h3'
import { vercelApi } from '~~/server/utils/api'

interface VercelDeployment {
  uid: string
  state?: string
  readyState?: string
  target?: string
  createdAt?: number
  created?: number
  inspectorUrl?: string
  meta?: Record<string, string>
}

interface VercelResponse {
  deployments: VercelDeployment[]
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const collapse = query.collapse === 'true' || query.collapse === '1'

  const data = await vercelApi<VercelResponse>('/deployments', {
    query: { limit: '75' },
  })

  const mapped = data.deployments.map((d) => {
    const meta = d.meta ?? {}

    const branch =
      meta.githubCommitRef ??
      meta.gitlabCommitRef ??
      meta.bitbucketCommitRef ??
      null

    const fullSha =
      meta.githubCommitSha ??
      meta.gitlabCommitSha ??
      meta.bitbucketCommitSha ??
      null

    const rawCommitMessage =
      meta.githubCommitMessage ??
      meta.gitlabCommitMessage ??
      meta.bitbucketCommitMessage ??
      null

    const commitMessage = rawCommitMessage && rawCommitMessage.includes('Triggered-By:')
      ? rawCommitMessage.split('Triggered-By:')[0].trim()
      : rawCommitMessage

    const commitAuthor =
      meta.githubCommitAuthorLogin ??
      meta.gitlabCommitAuthorName ??
      meta.bitbucketCommitAuthorName ??
      null

    let deployer: string | null = null
    if (rawCommitMessage && rawCommitMessage.includes('Triggered-By:')) {
      const parts = rawCommitMessage.split('Triggered-By:')
      const email = parts[parts.length - 1].trim()
      if (email) {
        deployer = email
      }
    }

    const prId = meta.githubPrId ?? null
    const ghOrg = meta.githubOrg ?? null
    const ghRepo = meta.githubRepo ?? null
    const prUrl = prId && ghOrg && ghRepo
      ? `https://github.com/${ghOrg}/${ghRepo}/pull/${prId}`
      : null

    return {
      uid: d.uid,
      state: d.readyState ?? d.state ?? 'UNKNOWN',
      target: d.target ?? null,
      createdAt: d.createdAt ?? d.created ?? null,
      inspectorUrl: d.inspectorUrl ?? null,
      branch,
      commitSha: fullSha ? fullSha.slice(0, 7) : null,
      commitMessage,
      commitAuthor,
      deployer,
      prUrl,
      prId,
    }
  })

  const deployments = (() => {
    if (!collapse) return mapped

    // Keep only the latest deployment per branch (Vercel returns newest-first)
    const seen = new Set<string>()
    return mapped.filter((d) => {
      const key = d.branch ?? d.uid
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })()

  return {
    projectName: data.deployments[0]?.name ?? 'Vercel Project',
    deployments,
  }
})
