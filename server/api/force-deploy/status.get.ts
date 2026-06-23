interface GithubRun {
  id: number
  status: string
  conclusion: string | null
  html_url: string
  created_at: string
}

export default defineEventHandler(async (event) => {
  const { branch, since } = getQuery(event) as { branch?: string; since?: string }
  if (!branch) throw createError({ statusCode: 400, message: 'branch is required' })

  const token = process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO

  if (!token || !owner || !repo) {
    throw createError({ statusCode: 500, message: 'Missing GitHub env vars' })
  }

  const url = new URL(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/manual-empty-commit.yml/runs`,
  )
  url.searchParams.set('branch', branch)
  url.searchParams.set('per_page', '5')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw createError({ statusCode: res.status, message: `GitHub API error: ${res.statusText}. ${body}` })
  }

  const data = await res.json() as { workflow_runs: GithubRun[] }
  const sinceMs = since ? parseInt(since, 10) : 0

  // Find newest run created at/after dispatch time (90s buffer for GitHub lag + clock skew)
  const run = sinceMs > 0
    ? data.workflow_runs.find(r => new Date(r.created_at).getTime() >= sinceMs - 90_000) ?? null
    : data.workflow_runs[0] ?? null

  if (!run) return null

  return {
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    html_url: run.html_url,
    created_at: run.created_at,
  }
})
