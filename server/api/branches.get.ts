export default defineEventHandler(async () => {
  const token = process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO

  if (!token || !owner || !repo) {
    throw createError({ statusCode: 500, message: 'Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO env vars' })
  }

  const branches: string[] = []
  let page = 1

  while (true) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=5&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw createError({ statusCode: res.status, message: `GitHub API error: ${res.statusText}. ${body}` })
    }

    const data = await res.json() as Array<{ name: string }>
    branches.push(...data.map(b => b.name))

    if (data.length < 100) break
    page++
  }

  return branches
})
