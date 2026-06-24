<script setup lang="ts">
interface Deployment {
  uid: string
  state: string
  target: string | null
  createdAt: number | null
  inspectorUrl: string | null
  branch: string | null
  commitSha: string | null
  commitMessage: string | null
  commitAuthor: string | null
  prUrl?: string | null
  prId?: string | null
  _pending?: boolean
  _originUid?: string
  _githubRunUrl?: string | null
}

const route = useRoute()
const router = useRouter()
const autoRefresh = ref(false)

const { public: { jiraOrg } } = useRuntimeConfig()

const JIRA_TICKET_RE = /([A-Z]+-\d+)/

function getJiraTicket(branch: string | null): string | null {
  if (!branch || !jiraOrg) return null
  const m = branch.match(JIRA_TICKET_RE)
  return m ? m[1] : null
}

function getJiraUrl(branch: string | null): string | null {
  const ticket = getJiraTicket(branch)
  return ticket ? `https://${jiraOrg}.atlassian.net/browse/${ticket}` : null
}

const collapsed = ref((route.query.collapse as string) !== '0')
const { data, pending, error, refresh } = await useFetch<Deployment[]>('/api/deployments', {
  query: { collapse: collapsed },
})
const { data: project } = await useFetch<{ name: string }>('/api/project')

const openDropdown = ref<string | null>(null)
const cancelling = ref<string | null>(null)
const CANCELLABLE = new Set(['BUILDING', 'QUEUED', 'INITIALIZING'])
const DEPLOYABLE = new Set(['CANCELED', 'BLOCKED'])

async function cancelDeployment(e: MouseEvent, uid: string) {
  e.stopPropagation()
  cancelling.value = uid
  try {
    await $fetch(`/api/deployments/${uid}/cancel`, { method: 'PATCH' })
    await refresh()
  } finally {
    cancelling.value = null
  }
}

const search = ref((route.query.q as string) ?? '')
const filterStatus = ref((route.query.status as string) ?? '')
const filterAuthor = ref((route.query.author as string) ?? '')

const searchInput = ref<HTMLInputElement | null>(null)
const branchInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      searchInput.value?.focus()
    }
    if (e.key === 'Escape') {
      if (confirmPending.value) confirmPending.value = null
      if (deployBranchDialog.value.open) deployBranchDialog.value.open = false
      openDropdown.value = null
    }
  }
  const onDocClick = () => { openDropdown.value = null }
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onDocClick)
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    document.removeEventListener('click', onDocClick)
  })
})

function syncUrl() {
  const query: Record<string, string> = {}
  if (search.value) query.q = search.value
  if (filterStatus.value) query.status = filterStatus.value
  if (filterAuthor.value) query.author = filterAuthor.value
  if (!collapsed.value) query.collapse = '0'
  router.replace({ query })
}

watch([filterStatus, filterAuthor, collapsed], syncUrl)

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(syncUrl, 300)
})

const hasFilters = computed(() =>
  !!(search.value || filterStatus.value || filterAuthor.value),
)

function clearFilters() {
  search.value = ''
  filterStatus.value = ''
  filterAuthor.value = ''
  router.replace({ query: {} })
}

const uniqueStatuses = computed(() =>
  [...new Set((data.value ?? []).map(d => d.state).filter(Boolean))] as string[],
)

const uniqueAuthors = computed(() =>
  [...new Set((data.value ?? []).map(d => d.commitAuthor).filter(Boolean))] as string[],
)

const filteredDeployments = computed(() => {
  const real = (data.value ?? []).filter((d) => {
    if (filterStatus.value && d.state?.toUpperCase() !== filterStatus.value.toUpperCase()) return false
    if (filterAuthor.value && d.commitAuthor !== filterAuthor.value) return false
    const q = search.value.toLowerCase().trim()
    if (q) {
      return (
        (d.branch ?? '').toLowerCase().includes(q) ||
        (d.commitMessage ?? '').toLowerCase().includes(q) ||
        (d.commitAuthor ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })
  return [...pendingDeployments.value, ...real]
})

const stateClass: Record<string, string> = {
  READY: 'state-ready',
  ERROR: 'state-error',
  BUILDING: 'state-building',
  CANCELED: 'state-canceled',
  QUEUED: 'state-queued',
  INITIALIZING: 'state-queued',
}

function getBadgeClass(state: string) {
  return stateClass[state?.toUpperCase()] ?? 'state-unknown'
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function relativeTime(ts: number): string {
  const diffSec = (ts - Date.now()) / 1000
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(Math.round(diffSec), 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  return rtf.format(Math.round(diffSec / 86400), 'day')
}

function formatCreatedAt(ts: number | null): string {
  if (!ts) return '—'
  const date = new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).format(new Date(ts))
  return `${date} · ${relativeTime(ts)}`
}

let timer: ReturnType<typeof setInterval> | null = null

watch(autoRefresh, (enabled) => {
  if (enabled) {
    timer = setInterval(() => refresh(), 30_000)
  } else {
    if (timer !== null) { clearInterval(timer); timer = null }
  }
})

onUnmounted(() => {
  if (timer !== null) clearInterval(timer)
  if (searchTimer !== null) clearTimeout(searchTimer)
  fdTimers.forEach((_, uid) => stopFdPoll(uid))
})

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  navigateTo('/login')
}

const copied = ref<string | null>(null)
const avatarErrors = ref<Record<string, boolean>>({})

async function copyBranch(e: MouseEvent, branch: string, uid: string) {
  e.stopPropagation()
  await navigator.clipboard.writeText(branch)
  copied.value = uid
  setTimeout(() => { copied.value = null }, 1500)
}

async function copySha(e: MouseEvent, sha: string, uid: string) {
  e.stopPropagation()
  await navigator.clipboard.writeText(sha)
  copied.value = `${uid}-sha`
  setTimeout(() => { copied.value = null }, 1500)
}

// ── Deploy a branch dialog ────────────────────────────────────────────────────
const deployBranchDialog = ref<{ open: boolean; selectedBranch: string }>({ open: false, selectedBranch: '' })

async function openDeployBranchDialog() {
  let prefill = ''
  try {
    const text = await navigator.clipboard.readText()
    if (text && !text.includes('\n') && text.length < 200) prefill = text.trim()
  } catch {}
  deployBranchDialog.value = { open: true, selectedBranch: prefill }
  if (prefill) {
    await nextTick()
    branchInput.value?.select()
  } else {
    await nextTick()
    branchInput.value?.focus()
  }
}

async function submitDeployBranch() {
  const branch = deployBranchDialog.value.selectedBranch
  if (!branch) return
  deployBranchDialog.value.open = false
  const syntheticUid = `branch-deploy-${branch}-${Date.now()}`
  await runForceDeploy(syntheticUid, branch)
}

// ── Force deploy ─────────────────────────────────────────────────────────────
const pendingDeployments = ref<Deployment[]>([])
const fdTimers = new Map<string, ReturnType<typeof setInterval>>()
const fdDispatchedAt = new Map<string, number>()
const fdErrors = ref<Record<string, string>>({})

function stopFdPoll(uid: string) {
  const t = fdTimers.get(uid)
  if (t !== undefined) { clearInterval(t); fdTimers.delete(uid) }
}

function updatePending(originUid: string, patch: Partial<Deployment>) {
  const idx = pendingDeployments.value.findIndex(d => d._originUid === originUid)
  if (idx !== -1) pendingDeployments.value[idx] = { ...pendingDeployments.value[idx], ...patch }
}

function removePending(originUid: string) {
  pendingDeployments.value = pendingDeployments.value.filter(d => d._originUid !== originUid)
}

async function pollRunStatus(uid: string, branch: string) {
  const since = fdDispatchedAt.get(uid) ?? Date.now()
  try {
    type Run = { id: number; status: string; conclusion: string | null; html_url: string }
    const run = await $fetch<Run | null>('/api/force-deploy/status', { query: { branch, since } })
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

const confirmPending = ref<{ uid: string; branch: string } | null>(null)

function forceDeploy(e: MouseEvent, uid: string, branch: string) {
  e.stopPropagation()
  confirmPending.value = { uid, branch }
}

async function confirmForceDeploy() {
  if (!confirmPending.value) return
  const { uid, branch } = confirmPending.value
  confirmPending.value = null
  await runForceDeploy(uid, branch)
}

async function runForceDeploy(uid: string, branch: string) {
  stopFdPoll(uid)
  delete fdErrors.value[uid]

  const original = data.value?.find(d => d.uid === uid)
  pendingDeployments.value = [
    {
      uid: `fd-pending-${uid}`,
      state: 'QUEUED',
      target: original?.target ?? null,
      createdAt: Date.now(),
      inspectorUrl: null,
      branch,
      commitSha: null,
      commitMessage: 'chore: add an empty commit.',
      commitAuthor: null,
      _pending: true,
      _originUid: uid,
      _githubRunUrl: null,
    },
    ...pendingDeployments.value.filter(d => d._originUid !== uid),
  ]

  fdDispatchedAt.set(uid, Date.now())

  try {
    await $fetch('/api/force-deploy', { method: 'POST', body: { branch } })
  } catch (err: any) {
    removePending(uid)
    fdErrors.value[uid] = err?.data?.message ?? err?.message ?? 'Failed to trigger deploy'
    return
  }

  await pollRunStatus(uid, branch)
  const t = setInterval(() => pollRunStatus(uid, branch), 3_000)
  fdTimers.set(uid, t)

  setTimeout(() => {
    const phantom = pendingDeployments.value.find(d => d._originUid === uid)
    if (phantom && !phantom._githubRunUrl) {
      stopFdPoll(uid)
      updatePending(uid, { state: 'ERROR', commitMessage: 'No run appeared — check GitHub Actions' })
    }
  }, 60_000)
}

function isFdBusy(uid: string): boolean {
  const phantom = pendingDeployments.value.find(d => d._originUid === uid)
  return !!phantom && phantom.state !== 'ERROR'
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div class="header-left">
        <div class="app-brand">
          <img src="https://console.docoitest.com/favicon.ico" style="width:20;height:20px" />
          <span class="app-name">{{ project?.name ?? '—' }}</span>
        </div>
        <span v-if="data" class="count">{{ filteredDeployments.length }}</span>
      </div>
      <div class="controls">
        <button class="btn" :disabled="pending" @click="refresh">
          <span :class="{ spinning: pending }">↻</span>
          Refresh
        </button>
        <button class="btn auto-btn" :class="{ 'auto-btn--on': autoRefresh }" @click="autoRefresh = !autoRefresh">
          <span class="auto-dot" :class="{ 'auto-dot--on': autoRefresh }" />
          Auto (30s)
        </button>
        <button class="btn btn-primary" @click="openDeployBranchDialog">
          <svg xmlns="http://www.w3.org/2000/svg" class="btn-icon" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
            <path d="M12 15 9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
          </svg>
          Deploy a Branch
        </button>
        <button class="btn logout-btn" @click="logout">Logout</button>
      </div>
    </header>

    <!-- Filter bar -->
    <div v-if="data" class="filter-bar">
      <input ref="searchInput" v-model="search" class="search" type="search"
        placeholder="Search branch, commit, author… (⌘K)" aria-label="Search deployments" />
      <select v-model="filterStatus" class="filter-select">
        <option value="">All statuses</option>
        <option v-for="s in uniqueStatuses" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="filterAuthor" class="filter-select">
        <option value="">All authors</option>
        <option v-for="a in uniqueAuthors" :key="a" :value="a">{{ a }}</option>
      </select>
      <button v-if="hasFilters" class="btn clear-btn" @click="clearFilters">✕ Clear</button>
    </div>

    <div v-if="pending && !data" class="empty-state">
      <div class="spinner" />
      <span>Loading deployments…</span>
    </div>

    <div v-else-if="error" class="empty-state error-state">
      <span class="error-icon">⚠</span>
      <span>{{ error.message }}</span>
    </div>

    <div v-else-if="!filteredDeployments.length" class="empty-state">
      <span>No deployments found{{ hasFilters ? ' for the active filters' : '' }}.</span>
    </div>

    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>
              <div class="th-branch-header">
                <button
                  class="collapse-icon-btn"
                  :class="{ 'collapse-icon-btn--on': collapsed }"
                  :title="collapsed ? 'Expand branches (show all deployments)' : 'Collapse branches (latest per branch)'"
                  @click.stop="collapsed = !collapsed"
                >
                 <svg v-if="collapsed" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 32 32">
  <path d="M0 0h32v32H0z" fill="none" />
  <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m23 26l-7-7l-7 7M9 6l7 7l7-7" />
</svg> 
<svg v-else xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
  <path d="M0 0h24v24H0z" fill="none" />
  <path fill="currentColor" d="m12 22l-6-6l1.425-1.425L12 19.15l4.575-4.575L18 16zM7.45 9.4L6 8l6-6l6 6l-1.45 1.4L12 4.85z" />
</svg>
                </button>
                Branch / Commit
              </div>
            </th>
            <th>Status</th>
            <th>Created At</th>
            <th>Commit Author</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in filteredDeployments" :key="d.uid"
            :class="['clickable-row', { 'pending-row': d._pending }]"
            :tabindex="d._pending ? -1 : 0"
            @click="!d._pending && navigateTo(`/deployments/${d.uid}`)"
            @keydown.enter="!d._pending && navigateTo(`/deployments/${d.uid}`)">
            <td>
              <div v-if="d.branch" class="branch-row">
                <span class="branch">{{ d.branch }}</span>
                <span v-if="d.target === 'production'" class="prod-tag">Production</span>
              </div>
              <div v-if="d.commitSha" class="commit-line">
                <code v-if="d.commitSha" class="sha">{{ d.commitSha }}</code>
                <button v-if="d.commitSha" class="sha-copy-btn" :class="{ copied: copied === `${d.uid}-sha` }"
                  :title="copied === `${d.uid}-sha` ? 'Copied!' : 'Copy commit SHA'"
                  @click="copySha($event, d.commitSha, d.uid)">
                  <svg v-if="copied !== `${d.uid}-sha`" xmlns="http://www.w3.org/2000/svg" width="11" height="11"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                    stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
                <span class="commit-msg" :class="{ 'commit-msg--pending': d._pending }">{{ d.commitMessage }}</span>
              </div>
            </td>
            <td>
              <div class="status-cell">
                <span :class="['badge', getBadgeClass(d.state), { 'badge--pulse': d._pending && d.state !== 'ERROR' }]">
                  {{ d.state }}
                </span>
                <button v-if="!d._pending && CANCELLABLE.has(d.state?.toUpperCase())" class="cancel-btn"
                  :disabled="cancelling === d.uid" @click="cancelDeployment($event, d.uid)">{{ cancelling === d.uid ?
                  '…' : 'Cancel' }}</button>
              </div>
            </td>
            <td class="created-at">{{ formatCreatedAt(d.createdAt) }}</td>
            <td>
              <div class="author-cell">
                <img v-if="d.commitAuthor && !avatarErrors[d.uid]"
                  :src="`https://github.com/${d.commitAuthor}.png?size=32`"
                  :alt="d.commitAuthor" class="avatar"
                  @error="avatarErrors[d.uid] = true" />
                <svg v-else-if="d.commitAuthor" class="avatar avatar-bot" viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg" aria-label="bot">
                  <rect x="3" y="7" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/>
                  <line x1="10" y1="3" x2="10" y2="7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                  <circle cx="10" cy="2.5" r="1" fill="currentColor"/>
                  <circle cx="7" cy="12" r="1.4" fill="currentColor"/>
                  <circle cx="13" cy="12" r="1.4" fill="currentColor"/>
                  <line x1="7.5" y1="15" x2="12.5" y2="15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                <span class="author">{{ d.commitAuthor || '—' }}</span>
              </div>
            </td>
            <td class="fd-cell">
              <div class="action-stack">
                <!-- Pending phantom row -->
                <template v-if="d._pending">
                  <svg v-if="!d._githubRunUrl && d.state !== 'ERROR'" class="pending-spin" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.8"
                      stroke-dasharray="28" stroke-dashoffset="10" stroke-linecap="round"/>
                  </svg>
                  <a v-else-if="d._githubRunUrl" :href="d._githubRunUrl" target="_blank" rel="noopener noreferrer"
                    :class="['run-chip', d.state === 'ERROR' ? 'run-chip--failed' : 'run-chip--running']"
                    @click.stop>
                    {{ d.state === 'ERROR' ? 'View failure ↗' : 'View run ↗' }}
                  </a>
                </template>
                <template v-else>
                  <!-- Deploy button — always shown, disabled when not deployable -->
                  <button class="force-btn"
                    :disabled="!d.branch || !DEPLOYABLE.has(d.state?.toUpperCase()) || isFdBusy(d.uid)"
                    :title="!d.branch || !DEPLOYABLE.has(d.state?.toUpperCase()) ? 'Not available' : `Deploy ${d.branch}`"
                    @click="d.branch && DEPLOYABLE.has(d.state?.toUpperCase()) && forceDeploy($event, d.uid, d.branch!)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="btn-icon" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                      <path d="M12 15 9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                    </svg>
                    Deploy
                  </button>
                  <span v-if="fdErrors[d.uid]" class="run-chip run-chip--failed" :title="fdErrors[d.uid]">Error</span>
                  <!-- 3-dot options menu -->
                  <div class="dots-menu" @click.stop>
                    <button class="dots-btn" :class="{ 'dots-btn--open': openDropdown === d.uid }"
                      @click="openDropdown = openDropdown === d.uid ? null : d.uid">
                      <svg width="3" height="13" viewBox="0 0 3 13" fill="currentColor">
                        <circle cx="1.5" cy="1.5" r="1.5"/>
                        <circle cx="1.5" cy="6.5" r="1.5"/>
                        <circle cx="1.5" cy="11.5" r="1.5"/>
                      </svg>
                    </button>
                    <div v-if="openDropdown === d.uid" class="dots-dropdown">
                      <a :href="d.prUrl ?? undefined" :target="d.prUrl ? '_blank' : undefined" rel="noopener noreferrer"
                        :class="['dots-item', { 'dots-item--disabled': !d.prUrl }]"
                        :title="d.prUrl ? `View PR #${d.prId}` : 'No PR linked'"
                        @click="!d.prUrl ? $event.preventDefault() : openDropdown = null">
                        <svg class="dots-item-icon" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M7.177 3.073L9.573.677A.25.25 0 0 1 10 .854v4.792a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354zM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25zM11 2.5h-1V4h1a1 1 0 0 1 1 1v5.628a2.251 2.251 0 1 0 1.5 0V5A2.5 2.5 0 0 0 11 2.5zm1 10.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0zM3.75 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z"/>
                        </svg>
                        {{ d.prUrl ? `PR #${d.prId}` : 'No PR linked' }}
                      </a>
                      <a :href="getJiraUrl(d.branch) ?? undefined" :target="getJiraUrl(d.branch) ? '_blank' : undefined" rel="noopener noreferrer"
                        :class="['dots-item', { 'dots-item--disabled': !getJiraTicket(d.branch) }]"
                        :title="getJiraTicket(d.branch) ? `View ${getJiraTicket(d.branch)} in Jira` : 'No Jira ticket in branch name'"
                        @click="!getJiraUrl(d.branch) ? $event.preventDefault() : openDropdown = null">
                        <svg class="dots-item-icon" viewBox="0 0 16 16" fill="#2684ff">
                          <path d="M15.29 0H7.61a3.47 3.47 0 0 0 3.47 3.47h1.42v1.38a3.47 3.47 0 0 0 3.47 3.47V.71A.71.71 0 0 0 15.29 0"/>
                          <path fill="url(#jira-a)" d="M11.47 3.83H3.8a3.47 3.47 0 0 0 3.47 3.47h1.41v1.37a3.47 3.47 0 0 0 3.47 3.47V4.54a.71.71 0 0 0-.71-.71"/>
                          <path fill="url(#jira-b)" d="M7.66 7.66H0a3.47 3.47 0 0 0 3.47 3.47h1.41v1.37A3.47 3.47 0 0 0 8.35 16V8.37a.71.71 0 0 0-.7-.71"/>
                          <defs>
                            <linearGradient id="jira-a" x1="100%" x2="55%" y1="0%" y2="45%">
                              <stop offset="18%" stop-color="#0052cc"/><stop offset="100%" stop-color="#2684ff"/>
                            </linearGradient>
                            <linearGradient id="jira-b" x1="100%" x2="55%" y1="0%" y2="45%">
                              <stop offset="18%" stop-color="#0052cc"/><stop offset="100%" stop-color="#2684ff"/>
                            </linearGradient>
                          </defs>
                        </svg>
                        {{ getJiraTicket(d.branch) ?? 'No Jira ticket' }}
                      </a>
                    </div>
                  </div>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <Teleport to="body">
    <!-- Deploy a Branch dialog -->
    <div v-if="deployBranchDialog.open" class="dialog-overlay" @click.self="deployBranchDialog.open = false">
      <div class="dialog" role="dialog" aria-modal="true">
        <div class="dialog-icon-wrap">
          <svg class="dialog-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
            <path d="M12 15 9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
          </svg>
        </div>
        <p class="dialog-title">Deploy a Branch</p>
        <p class="dialog-body">Select a branch to trigger a new Vercel deployment via GitHub Actions.</p>
        <input
          ref="branchInput"
          v-model="deployBranchDialog.selectedBranch"
          class="branch-input"
          type="text"
          placeholder="Branch name…"
          autocomplete="off"
          spellcheck="false"
        />
        <div class="dialog-actions">
          <button class="btn" @click="deployBranchDialog.open = false">Cancel</button>
          <button class="dialog-confirm dialog-confirm--primary"
            :disabled="!deployBranchDialog.selectedBranch || deployBranchDialog.loadingBranches"
            @click="submitDeployBranch">
            Deploy
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="confirmPending" class="dialog-overlay" @click.self="confirmPending = null">
      <div class="dialog" role="dialog" aria-modal="true">
        <div class="dialog-icon-wrap">
          <svg class="dialog-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <p class="dialog-title">Deploy</p>
        <p class="dialog-body">
          This will push an empty commit to
          <code class="dialog-branch">{{ confirmPending.branch }}</code>
          on GitHub, triggering a new Vercel deployment.
        </p>
        <div class="dialog-actions">
          <button class="btn" @click="confirmPending = null">Cancel</button>
          <button class="dialog-confirm" @click="confirmForceDeploy">Deploy</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-logo {
  flex-shrink: 0;
}

.app-name {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #fff;
}

.count {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 20px;
  color: #888;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.1rem 0.5rem;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
}

.search {
  background: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #ededed;
  font-size: 0.8125rem;
  outline: none;
  padding: 0.4rem 0.75rem;
  transition: border-color 0.15s;
  width: 300px;
}

.search:focus {
  border-color: #555;
}

.search::placeholder {
  color: #444;
}

.btn {
  align-items: center;
  background: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #ededed;
  cursor: pointer;
  display: inline-flex;
  font-size: 0.875rem;
  gap: 0.375rem;
  padding: 0.4rem 0.75rem;
  transition: border-color 0.15s, background 0.15s;
}

.btn:hover:not(:disabled) {
  background: #111;
  border-color: #444;
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.spinning {
  display: inline-block;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.logout-btn {
  color: #666;
}

.logout-btn:hover {
  color: #e5484d;
  border-color: rgba(229, 72, 77, 0.4);
  background: rgba(229, 72, 77, 0.06);
}

.auto-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #333;
  flex-shrink: 0;
  transition: background 0.15s;
}

.auto-dot--on {
  background: #00c950;
}

/* Filter bar */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.filter-select {
  appearance: none;
  background: #0a0a0a url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23555'/%3E%3C/svg%3E") no-repeat right 0.6rem center;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #aaa;
  cursor: pointer;
  font-size: 0.8125rem;
  outline: none;
  padding: 0.4rem 2rem 0.4rem 0.75rem;
  transition: border-color 0.15s, color 0.15s;
}

.filter-select:focus {
  border-color: #555;
}

.filter-select:hover {
  border-color: #3a3a3a;
}

.filter-select option {
  background: #111;
  color: #ededed;
}

.filter-select[value]:not([value=""]) {
  border-color: #0070f3;
  color: #ededed;
}

.th-branch-header {
  align-items: center;
  display: flex;
  gap: 0.375rem;
}

.collapse-icon-btn {
  align-items: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #444;
  cursor: pointer;
  display: inline-flex;
  flex-shrink: 0;
  padding: 0.15rem;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.collapse-icon-btn svg {
  height: 13px;
  width: 13px;
}

.collapse-icon-btn:hover {
  background: #111;
  border-color: #333;
  color: #888;
}

.collapse-icon-btn--on {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
  color: #ccc;
}

.clear-btn {
  color: #e5484d;
  border-color: rgba(229, 72, 77, 0.3);
  font-size: 0.8125rem;
}

.clear-btn:hover:not(:disabled) {
  background: rgba(229, 72, 77, 0.08);
  border-color: #e5484d;
  color: #e5484d;
}

/* Empty / loading states */
.empty-state {
  align-items: center;
  color: #666;
  display: flex;
  flex-direction: column;
  font-size: 0.9375rem;
  gap: 0.75rem;
  justify-content: center;
  padding: 5rem 2rem;
}

.error-state {
  color: #e5484d;
}

.error-icon {
  font-size: 1.5rem;
}

.spinner {
  animation: spin 0.7s linear infinite;
  border: 2px solid #222;
  border-top-color: #555;
  border-radius: 50%;
  height: 24px;
  width: 24px;
}

.status-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cancel-btn {
  background: transparent;
  border: 1px solid rgba(229, 72, 77, 0.3);
  border-radius: 4px;
  color: #e5484d;
  cursor: pointer;
  font-size: 0.6875rem;
  padding: 0.15rem 0.4rem;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.cancel-btn:hover:not(:disabled) {
  background: rgba(229, 72, 77, 0.08);
  border-color: #e5484d;
}

.cancel-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

/* Table */
.table-wrap {
  border: 1px solid #1a1a1a;
  border-radius: 8px;
  overflow-x: auto;
}

.table {
  border-collapse: collapse;
  font-size: 0.875rem;
  width: 100%;
}

.table thead {
  border-bottom: 1px solid #1a1a1a;
}

.table th {
  color: #555;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  padding: 0.625rem 1rem;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.table td {
  border-bottom: 1px solid #111;
  padding: 0.8125rem 1rem;
  vertical-align: middle;
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.table tbody tr:hover td {
  background: #080808;
}

.clickable-row {
  cursor: pointer;
  outline: none;
}

.clickable-row:focus-visible td {
  background: #0a0a0a;
}

.pending-row {
  cursor: default;
}

.pending-row td {
  background: rgba(255, 153, 10, 0.02);
}

.pending-row:hover td {
  background: rgba(255, 153, 10, 0.03);
}

.badge--pulse {
  animation: badge-pulse 1.8s ease-in-out infinite;
}

@keyframes badge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

.commit-msg--pending {
  color: #555;
  font-style: italic;
}

/* Badge */
.badge {
  border-radius: 4px;
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  padding: 0.2rem 0.5rem;
  text-transform: uppercase;
  white-space: nowrap;
}

.state-ready {
  background: rgba(0, 201, 80, 0.12);
  color: #00c950;
}

.state-error {
  background: rgba(229, 72, 77, 0.12);
  color: #e5484d;
}

.state-building {
  background: rgba(255, 153, 10, 0.12);
  color: #ff990a;
}

.state-canceled {
  background: rgba(136, 136, 136, 0.12);
  color: #777;
}

.state-queued {
  background: rgba(0, 112, 243, 0.12);
  color: #4d9ff0;
}

.state-unknown {
  background: rgba(100, 100, 100, 0.1);
  color: #555;
}

.prod-tag {
  background: rgba(0, 112, 243, 0.1);
  border: 1px solid rgba(0, 112, 243, 0.2);
  border-radius: 3px;
  color: #4d9ff0;
  display: inline-block;
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  padding: 0.1rem 0.375rem;
}

/* Branch / commit */
.branch-row {
  align-items: center;
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.branch {
  color: #ededed;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.8125rem;
}

.commit-line {
  align-items: baseline;
  display: flex;
  gap: 0.4rem;
  margin-top: 0.25rem;
}

.sha {
  background: #111;
  border: 1px solid #222;
  border-radius: 3px;
  color: #666;
  flex-shrink: 0;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.75rem;
  padding: 0.05rem 0.35rem;
}

.commit-msg {
  color: #666;
  font-size: 0.8125rem;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-btn {
  background: transparent;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  color: #555;
  cursor: pointer;
  font-size: 0.625rem;
  padding: 0.05rem 0.3rem;
  transition: border-color 0.15s, color 0.15s;
  white-space: nowrap;
}

.copy-btn:hover {
  border-color: #444;
  color: #aaa;
}

.copy-btn.copied {
  border-color: #00c950;
  color: #00c950;
}

.sha-copy-btn {
  align-items: center;
  background: transparent;
  border: none;
  color: #444;
  cursor: pointer;
  display: inline-flex;
  flex-shrink: 0;
  padding: 0;
  transition: color 0.15s;
}

.sha-copy-btn:hover {
  color: #888;
}

.sha-copy-btn.copied {
  color: #00c950;
}

/* Author cell */
.author-cell {
  align-items: center;
  display: flex;
  gap: 0.5rem;
}

.avatar {
  border-radius: 50%;
  flex-shrink: 0;
  height: 20px;
  width: 20px;
  object-fit: cover;
}

.avatar-bot {
  color: #444;
}

.author {
  color: #888;
  font-size: 0.8125rem;
  white-space: nowrap;
}

/* Misc cells */
.created-at {
  color: #666;
  font-size: 0.8125rem;
  white-space: nowrap;
}

/* Force deploy */
.fd-cell {
  white-space: nowrap;
}

.action-stack {
  align-items: center;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 0.35rem;
}

/* 3-dot dropdown */
.dots-menu {
  position: relative;
}

.dots-btn {
  align-items: center;
  background: #111;
  border: 1px solid #383838;
  border-radius: 5px;
  color: #555;
  cursor: pointer;
  display: inline-flex;
  font-size: 0.8125rem;
  justify-content: center;
  padding: 0.3rem 0.5rem;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.dots-btn:hover,
.dots-btn--open {
  background: #1a1a1a;
  border-color: #555;
  color: #aaa;
}

.dots-dropdown {
  background: #111;
  border: 1px solid #2a2a2a;
  border-radius: 7px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  min-width: 160px;
  overflow: hidden;
  position: absolute;
  right: 0;
  top: calc(100% + 5px);
  z-index: 50;
}

.dots-item {
  align-items: center;
  color: #aaa;
  cursor: pointer;
  display: flex;
  font-size: 0.8125rem;
  gap: 0.5rem;
  padding: 0.55rem 0.875rem;
  text-decoration: none;
  transition: background 0.1s, color 0.1s;
}

.dots-item:hover:not(.dots-item--disabled) {
  background: #1a1a1a;
  color: #ededed;
}

.dots-item--disabled {
  color: #444;
  cursor: not-allowed;
  opacity: 0.6;
}

.dots-item-icon {
  flex-shrink: 0;
  height: 13px;
  width: 13px;
}

.force-btn {
  align-items: center;
  background: #111;
  border: 1px solid #383838;
  border-radius: 5px;
  color: #aaa;
  cursor: pointer;
  display: inline-flex;
  font-size: 0.8125rem;
  font-weight: 500;
  gap: 0.35rem;
  letter-spacing: 0.01em;
  padding: 0.3rem 0.75rem;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  white-space: nowrap;
}

.force-btn:hover:not(:disabled) {
  background: #1a1a1a;
  border-color: #555;
  color: #ededed;
}

.force-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.pending-spin {
  animation: spin 0.75s linear infinite;
  color: #ff990a;
  flex-shrink: 0;
  height: 13px;
  width: 13px;
}

.btn-icon {
  flex-shrink: 0;
  height: 14px;
  width: 14px;
}

/* Confirm dialog */
.dialog-overlay {
  align-items: center;
  background: rgba(0, 0, 0, 0.65);
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(2px);
}

.dialog {
  background: #0d0d0d;
  border: 1px solid #222;
  border-radius: 10px;
  max-width: 380px;
  padding: 1.75rem 1.5rem 1.5rem;
  width: calc(100% - 2rem);
}

.dialog-icon-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.dialog-icon {
  color: #555;
  height: 28px;
  width: 28px;
}

.dialog-title {
  color: #ededed;
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.625rem;
  text-align: center;
}

.dialog-body {
  color: #777;
  font-size: 0.8125rem;
  line-height: 1.6;
  margin: 0 0 1.5rem;
  text-align: center;
}

.dialog-branch {
  background: #111;
  border: 1px solid #2a2a2a;
  border-radius: 3px;
  color: #ccc;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.75rem;
  padding: 0.05rem 0.35rem;
}

.dialog-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.dialog-confirm {
  background: #111;
  border: 1px solid #383838;
  border-radius: 6px;
  color: #ccc;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0.4rem 0.9rem;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.dialog-confirm:hover {
  background: #161616;
  border-color: #555;
  color: #ededed;
}

/* Primary button */
.btn-primary {
  background: #0070f3;
  border-color: #0070f3;
  color: #fff;
  font-weight: 500;
}

.btn-primary:hover:not(:disabled) {
  background: #0060d3;
  border-color: #0060d3;
  color: #fff;
}


/* Branch text input in dialog */
.branch-input {
  background: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #ededed;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.8125rem;
  margin-bottom: 1.5rem;
  outline: none;
  padding: 0.5rem 0.75rem;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.branch-input:focus {
  border-color: #555;
}

.branch-input::placeholder {
  color: #444;
}


/* Primary confirm button */
.dialog-confirm--primary {
  background: #0070f3;
  border-color: #0070f3;
  color: #fff;
}

.dialog-confirm--primary:hover:not(:disabled) {
  background: #0060d3;
  border-color: #0060d3;
  color: #fff;
}

.dialog-confirm--primary:disabled {
  opacity: 0.4;
  cursor: default;
}

.run-chip {
  border-radius: 4px;
  display: inline-block;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 0.1rem 0.375rem;
  text-decoration: none;
  white-space: nowrap;
}

.run-chip--waiting {
  background: rgba(100, 100, 100, 0.1);
  color: #555;
}

.run-chip--running {
  background: rgba(255, 153, 10, 0.12);
  color: #ff990a;
}

.run-chip--success {
  background: rgba(0, 201, 80, 0.12);
  color: #00c950;
}

.run-chip--failed {
  background: rgba(229, 72, 77, 0.12);
  color: #e5484d;
}

</style>
