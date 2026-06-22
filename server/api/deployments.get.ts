interface VercelDeployment {
  uid: string
  state?: string
  readyState?: string
  url: string
  target?: string
  createdAt?: number
  created?: number
  inspectorUrl?: string
  meta?: Record<string, string>
}

interface VercelResponse {
  deployments: VercelDeployment[]
}

export default defineEventHandler(async () => {
  const token = process.env.VERCEL_TOKEN
  const projectId = process.env.PROJECT_ID
  const teamId = process.env.TEAM_ID

  if (!token || !projectId) {
    throw createError({ statusCode: 500, message: 'Missing VERCEL_TOKEN or PROJECT_ID env vars' })
  }

  const url = new URL('https://api.vercel.com/v6/deployments')
  url.searchParams.set('limit', '50')
  url.searchParams.set('projectId', projectId)
  if (teamId) url.searchParams.set('teamId', teamId)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw createError({ statusCode: res.status, message: `Vercel API error: ${res.statusText}. ${body}` })
  }

  const data: VercelResponse = await res.json()

  return data.deployments.map((d) => {
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

    const commitMessage =
      meta.githubCommitMessage ??
      meta.gitlabCommitMessage ??
      meta.bitbucketCommitMessage ??
      null

    const commitAuthor =
      meta.githubCommitAuthorLogin ??
      meta.gitlabCommitAuthorName ??
      meta.bitbucketCommitAuthorName ??
      null

    return {
      state: d.readyState ?? d.state ?? 'UNKNOWN',
      url: d.url,
      target: d.target ?? null,
      createdAt: d.createdAt ?? d.created ?? null,
      inspectorUrl: d.inspectorUrl ?? null,
      branch,
      commitSha: fullSha ? fullSha.slice(0, 7) : null,
      commitMessage,
      commitAuthor,
    }
  })
})
