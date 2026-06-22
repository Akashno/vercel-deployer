interface VercelDeploymentDetail {
  uid: string
  id: string
  name: string
  url: string
  alias?: string[]
  state?: string
  readyState?: string
  target?: string
  createdAt?: number
  buildingAt?: number
  readyAt?: number
  inspectorUrl?: string
  meta?: Record<string, string>
  creator?: { username?: string; email?: string }
  regions?: string[]
}

export default defineEventHandler(async (event) => {
  const uid = getRouterParam(event, 'uid')
  const token = process.env.PROJECT_TOKEN
  const teamId = process.env.TEAM_ID

  if (!token) {
    throw createError({ statusCode: 500, message: 'Missing PROJECT_TOKEN env var' })
  }

  const url = new URL(`https://api.vercel.com/v13/deployments/${uid}`)
  if (teamId) url.searchParams.set('teamId', teamId)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw createError({ statusCode: res.status, message: `Vercel API error: ${res.statusText}. ${body}` })
  }

  const d: VercelDeploymentDetail = await res.json()
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

  const repoUrl =
    meta.githubOrg && meta.githubRepo
      ? `https://github.com/${meta.githubOrg}/${meta.githubRepo}`
      : null

  const branchUrl =
    d.alias?.find((a) => a.includes('-git-')) ??
    d.url

  const buildDurationMs =
    d.buildingAt && d.readyAt ? d.readyAt - d.buildingAt : null

  return {
    uid: d.uid,
    name: d.name,
    state: d.readyState ?? d.state ?? 'UNKNOWN',
    url: branchUrl,
    target: d.target ?? null,
    createdAt: d.createdAt ?? null,
    buildingAt: d.buildingAt ?? null,
    readyAt: d.readyAt ?? null,
    buildDurationMs,
    inspectorUrl: d.inspectorUrl ?? null,
    branch,
    commitSha: fullSha ?? null,
    commitMessage,
    commitAuthor,
    repoUrl,
    regions: d.regions ?? [],
    creator: d.creator?.username ?? d.creator?.email ?? null,
  }
})
