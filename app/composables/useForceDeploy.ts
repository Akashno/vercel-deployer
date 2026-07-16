import type { Ref, ComputedRef } from 'vue'
import type { Deployment } from './useDeployments'

export function useForceDeploy(
  projectId: Ref<string | null>,
  deployments: Ref<Deployment[]> | ComputedRef<Deployment[]>,
  refresh: () => Promise<any>
) {
  const pendingDeployments = ref<Deployment[]>([])
  const fdTimers = new Map<string, ReturnType<typeof setInterval>>()
  const fdDispatchedAt = new Map<string, number>()
  const fdSha = new Map<string, string>()
  const fdErrors = ref<Record<string, string>>({})

  const confirmPending = ref<{ uid: string; branch: string } | null>(null)
  const deployBranchDialog = ref<{ open: boolean; selectedBranch: string }>({ open: false, selectedBranch: '' })

  function stopFdPoll(uid: string) {
    const t = fdTimers.get(uid)
    if (t !== undefined) {
      clearInterval(t)
      fdTimers.delete(uid)
    }
    fdSha.delete(uid)
  }

  function updatePending(originUid: string, patch: Partial<Deployment>) {
    const idx = pendingDeployments.value.findIndex(d => d._originUid === originUid)
    if (idx !== -1) {
      pendingDeployments.value[idx] = { ...pendingDeployments.value[idx], ...patch }
    }
  }

  function removePending(originUid: string) {
    pendingDeployments.value = pendingDeployments.value.filter(d => d._originUid !== originUid)
    fdSha.delete(originUid)
  }

  async function pollRunStatus(uid: string, branch: string) {
    if (!projectId.value) return
    const since = fdDispatchedAt.get(uid) ?? Date.now()
    const sha = fdSha.get(uid) ?? ''
    try {
      type Run = { id: string | number; status: string; conclusion: string | null; html_url: string }
      const run = await $fetch<Run | null>(`/api/projects/${projectId.value}/force-deploy/status`, { query: { branch, sha, since } })
      if (!run) return

      if (run.status === 'completed') {
        stopFdPoll(uid)
        if (run.conclusion !== 'success') {
          updatePending(uid, { state: 'ERROR', _githubRunUrl: run.html_url })
        } else {
          removePending(uid)
          await refresh()
        }
        return
      }

      updatePending(uid, {
        state: run.status === 'in_progress' ? 'BUILDING' : 'QUEUED',
        _githubRunUrl: run.html_url,
      })
    } catch {
      // transient network error — keep polling
    }
  }

  function forceDeploy(e: MouseEvent, uid: string, branch: string) {
    if (e) e.stopPropagation()
    confirmPending.value = { uid, branch }
  }

  async function confirmForceDeploy() {
    if (!confirmPending.value) return
    const { uid, branch } = confirmPending.value
    confirmPending.value = null
    await runForceDeploy(uid, branch)
  }

  async function runForceDeploy(uid: string, branch: string) {
    if (!projectId.value) return
    stopFdPoll(uid)
    delete fdErrors.value[uid]

    const original = deployments.value?.find(d => d.uid === uid)
    pendingDeployments.value = [
      {
        uid: `fd-pending-${uid}`,
        state: 'QUEUED',
        target: original?.target ?? null,
        createdAt: Date.now(),
        inspectorUrl: null,
        branch,
        commitSha: null,
        commitMessage: 'Creating empty commit...',
        commitAuthor: 'github-actions[bot]',
        _pending: true,
        _originUid: uid,
        _githubRunUrl: null,
      },
      ...pendingDeployments.value.filter(d => d._originUid !== uid),
    ]

    fdDispatchedAt.set(uid, Date.now())

    try {
      const res = await $fetch<{ ok: boolean; sha?: string; url?: string }>(`/api/projects/${projectId.value}/force-deploy`, {
        method: 'POST',
        body: { branch },
      })
      if (res?.sha) {
        fdSha.set(uid, res.sha)
        updatePending(uid, {
          commitSha: res.sha.slice(0, 7),
          commitMessage: 'chore: force redeploy [skip ci]',
          _githubRunUrl: res.url,
        })
      }
    } catch (err: any) {
      removePending(uid)
      fdErrors.value[uid] = err?.data?.message ?? err?.message ?? 'Failed to trigger deploy'
      return
    }

    await pollRunStatus(uid, branch)
    const t = setInterval(() => pollRunStatus(uid, branch), 4_000)
    fdTimers.set(uid, t)

    setTimeout(() => {
      const phantom = pendingDeployments.value.find(d => d._originUid === uid)
      if (phantom && phantom.state === 'QUEUED') {
        stopFdPoll(uid)
        updatePending(uid, { state: 'ERROR', commitMessage: 'Deployment did not start on Vercel' })
      }
    }, 90_000)
  }

  function openDeployBranchDialog() {
    deployBranchDialog.value = { open: true, selectedBranch: '' }
  }

  async function handleDeployBranch(branchName: string) {
    const syntheticUid = `branch-deploy-${branchName}-${Date.now()}`
    await runForceDeploy(syntheticUid, branchName)
  }

  // Clear all in-flight deploy state — used when the active project changes,
  // since pending rows and pollers are scoped to the project they were dispatched on.
  function resetForceDeploy() {
    fdTimers.forEach((_, uid) => stopFdPoll(uid))
    pendingDeployments.value = []
    fdDispatchedAt.clear()
    fdErrors.value = {}
    confirmPending.value = null
  }

  onUnmounted(() => {
    fdTimers.forEach((_, uid) => stopFdPoll(uid))
  })

  return {
    pendingDeployments,
    fdErrors,
    confirmPending,
    deployBranchDialog,
    forceDeploy,
    confirmForceDeploy,
    openDeployBranchDialog,
    handleDeployBranch,
    resetForceDeploy,
  }
}
