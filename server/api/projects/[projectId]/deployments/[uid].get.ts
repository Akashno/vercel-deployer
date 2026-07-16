import { defineEventHandler, getRouterParam, createError } from 'h3'
import { createVercelApi } from '~~/server/utils/api'
import { getProjectById } from '~~/server/utils/projects'
import { validateUid } from '~~/server/utils/validation'

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
  const project = getProjectById(getRouterParam(event, 'projectId'))
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })

  const uid = getRouterParam(event, 'uid')
  validateUid(uid)

  const vercelApi = createVercelApi(project)
  const d = await vercelApi<VercelDeploymentDetail>(`/v13/deployments/${uid}`)
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

  const ghOrg = meta.githubOrg ?? null
  const ghRepo = meta.githubRepo ?? null
  const prId = meta.githubPrId ?? null

  const repoUrl = ghOrg && ghRepo ? `https://github.com/${ghOrg}/${ghRepo}` : null

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
    prId,
    ghOrg,
    ghRepo,
    regions: d.regions ?? [],
    creator: d.creator?.username ?? d.creator?.email ?? null,
  }
})
