import { defineEventHandler, readBody, getCookie } from 'h3'
import { githubApi } from '~~/server/utils/api'
import { validateBranch } from '~~/server/utils/validation'
import { AUTH_COOKIE } from '~~/server/utils/auth'

interface GithubRefResponse {
  ref: string
  node_id: string
  url: string
  object: {
    sha: string
    type: string
    url: string
  }
}

interface GithubCommitResponse {
  sha: string
  url: string
  tree: {
    sha: string
    url: string
  }
}

export default defineEventHandler(async (event) => {
  const { branch } = await readBody<{ branch: string }>(event)
  validateBranch(branch)

  // Parse logged-in user details from cookie
  const cookieVal = getCookie(event, AUTH_COOKIE)
  const separatorIndex = cookieVal ? cookieVal.indexOf(':') : -1
  const loggedInEmail = separatorIndex !== -1 ? cookieVal.substring(0, separatorIndex) : 'unknown'

  // 1. Get the latest commit SHA of the branch
  const refData = await githubApi<GithubRefResponse>(`/git/ref/heads/${branch}`)
  const parentCommitSha = refData.object.sha

  // 2. Get the commit tree SHA
  const commitData = await githubApi<GithubCommitResponse>(`/git/commits/${parentCommitSha}`)
  const treeSha = commitData.tree.sha

  // 3. Create a new empty commit pointing to the parent tree
  const newCommit = await githubApi<{ sha: string }>(`/git/commits`, {
    method: 'POST',
    body: {
      message: `chore: redeploy branch Triggered-By: ${loggedInEmail}`,
      tree: treeSha,
      parents: [parentCommitSha],
      author: {
        name: 'github-actions[bot]',
        email: '41898282+github-actions[bot]@users.noreply.github.com',
      },
      committer: {
        name: 'github-actions[bot]',
        email: '41898282+github-actions[bot]@users.noreply.github.com',
      },
    },
  })
  const newCommitSha = newCommit.sha

  // 4. Update the branch ref to point to the new commit
  await githubApi(`/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: {
      sha: newCommitSha,
      force: true,
    },
  })

  const config = useRuntimeConfig()
  return {
    ok: true,
    sha: newCommitSha,
    url: `https://github.com/${config.githubOwner}/${config.githubRepo}/commit/${newCommitSha}`,
  }
})
