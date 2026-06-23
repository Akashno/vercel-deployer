export default defineEventHandler(async (event) => {
  const { branch } = await readBody<{ branch: string }>(event)
  if (!branch?.trim()) {
    throw createError({ statusCode: 400, message: 'branch is required' })
  }

  const token = process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO

  if (!token || !owner || !repo) {
    throw createError({ statusCode: 500, message: 'Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO env vars' })
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/manual-empty-commit.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main', inputs: { branch, message: 'Force deploy' } }),
    },
  )

  if (res.status !== 204) {
    const body = await res.text().catch(() => '')
    throw createError({ statusCode: res.status, message: `GitHub API error: ${res.statusText}. ${body}` })
  }

  return { ok: true }
})
