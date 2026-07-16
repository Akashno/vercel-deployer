import { defineEventHandler, getQuery, getRouterParam, createError } from 'h3'
import { getProjectById } from '~~/server/utils/projects'
import { validateOwnerRepo, validateSha } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const project = getProjectById(getRouterParam(event, 'projectId'))
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })
  if (!project.github) {
    throw createError({ statusCode: 500, message: `Server configuration error: project "${project.id}" has no GitHub configuration` })
  }

  const { owner, repo, pr, sha } = getQuery(event)

  validateOwnerRepo(owner, repo)
  validateSha(sha)
  if (pr && !/^\d+$/.test(pr as string)) {
    throw createError({ statusCode: 400, message: 'Invalid pull request number format' })
  }
  if (!owner || !repo || !pr) {
    throw createError({ statusCode: 400, message: 'Missing owner, repo, or pr' })
  }

  const token = project.github.token
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const base = `https://api.github.com/repos/${owner}/${repo}`

  const [prRes, reviewsRes, checksRes] = await Promise.all([
    fetch(`${base}/pulls/${pr}`, { headers }),
    fetch(`${base}/pulls/${pr}/reviews`, { headers }),
    sha ? fetch(`${base}/commits/${sha}/check-runs`, { headers }) : Promise.resolve(null),
  ])

  if (!prRes.ok) {
    throw createError({ statusCode: prRes.status, message: `GitHub API error: ${prRes.statusText}` })
  }

  const prData = await prRes.json()
  const reviewsData: any[] = reviewsRes.ok ? await reviewsRes.json() : []
  const checksData = checksRes?.ok ? await checksRes.json() : null

  // Latest review state per reviewer (ignore pure comments)
  const latestReviews = new Map<string, string>()
  for (const review of reviewsData) {
    if (review.state !== 'COMMENTED') {
      latestReviews.set(review.user.login, review.state)
    }
  }
  const reviewStates = Array.from(latestReviews.values())

  // Deduplicate check runs by name — keep latest (API returns newest first)
  const seen = new Set<string>()
  const checks = (checksData?.check_runs ?? [])
    .filter((c: any) => {
      if (seen.has(c.name)) return false
      seen.add(c.name)
      return true
    })
    .map((c: any) => ({
      name: c.name as string,
      status: c.status as string,
      conclusion: (c.conclusion ?? null) as string | null,
    }))

  return {
    number: prData.number as number,
    title: prData.title as string,
    state: prData.state as string,
    merged: (prData.merged ?? false) as boolean,
    additions: (prData.additions ?? 0) as number,
    deletions: (prData.deletions ?? 0) as number,
    changedFiles: (prData.changed_files ?? 0) as number,
    url: prData.html_url as string,
    baseBranch: (prData.base?.ref ?? null) as string | null,
    labels: (prData.labels ?? []).map((l: any) => ({ name: l.name as string, color: l.color as string })),
    reviews: {
      approved: reviewStates.filter(s => s === 'APPROVED').length,
      changesRequested: reviewStates.filter(s => s === 'CHANGES_REQUESTED').length,
    },
    checks,
  }
})
