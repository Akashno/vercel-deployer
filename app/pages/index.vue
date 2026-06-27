<script setup lang="ts">
const isDark = ref(true)

function toggleTheme() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}

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
interface DeploymentsResponse {
  projectName: string
  deployments: Deployment[]
}
const { data: resData, pending, error, refresh } = await useFetch<DeploymentsResponse>('/api/deployments', {
  query: { collapse: collapsed },
})
const data = computed(() => resData.value?.deployments ?? [])
const project = computed(() => ({ name: resData.value?.projectName ?? '—' }))

const inspectingUid = ref<string | null>(null)
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

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  if (route.query.inspect) {
    inspectingUid.value = route.query.inspect as string
  }
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
  if (inspectingUid.value) query.inspect = inspectingUid.value
  router.replace({ query })
}

watch([filterStatus, filterAuthor, collapsed, inspectingUid], syncUrl)

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

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function relativeTime(ts: number): string {
  const diffSec = (ts - Date.now()) / 1000
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(Math.round(diffSec), 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  return rtf.format(Math.round(diffSec / 86400), 'day')
}

function getCreatedAtTime(ts: number | null): string {
  if (!ts) return '—'
  return relativeTime(ts)
}

function getCreatedAtDate(ts: number | null): string {
  if (!ts) return ''
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(ts))
}

let timer: ReturnType<typeof setInterval> | null = null

onUnmounted(() => {
  if (timer !== null) clearInterval(timer)
  if (searchTimer !== null) clearTimeout(searchTimer)
  fdTimers.forEach((_, uid) => stopFdPoll(uid))
})

const copied = ref<string | null>(null)
const avatarErrors = ref<Record<string, boolean>>({})

async function copySha(e: MouseEvent, sha: string, uid: string) {
  e.stopPropagation()
  await navigator.clipboard.writeText(sha)
  copied.value = `${uid}-sha`
  setTimeout(() => { copied.value = null }, 1500)
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  navigateTo('/login')
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
}

async function handleDeployBranch(branchName: string) {
  const syntheticUid = `branch-deploy-${branchName}-${Date.now()}`
  await runForceDeploy(syntheticUid, branchName)
}

// ── Force deploy ─────────────────────────────────────────────────────────────
const pendingDeployments = ref<Deployment[]>([])
const fdTimers = new Map<string, ReturnType<typeof setInterval>>()
const fdDispatchedAt = new Map<string, number>()
const fdSha = new Map<string, string>()
const fdErrors = ref<Record<string, string>>({})

function stopFdPoll(uid: string) {
  const t = fdTimers.get(uid)
  if (t !== undefined) { clearInterval(t); fdTimers.delete(uid) }
  fdSha.delete(uid)
}

function updatePending(originUid: string, patch: Partial<Deployment>) {
  const idx = pendingDeployments.value.findIndex(d => d._originUid === originUid)
  if (idx !== -1) pendingDeployments.value[idx] = { ...pendingDeployments.value[idx], ...patch }
}

function removePending(originUid: string) {
  pendingDeployments.value = pendingDeployments.value.filter(d => d._originUid !== originUid)
  fdSha.delete(originUid)
}

async function pollRunStatus(uid: string, branch: string) {
  const since = fdDispatchedAt.get(uid) ?? Date.now()
  const sha = fdSha.get(uid) ?? ''
  try {
    type Run = { id: string | number; status: string; conclusion: string | null; html_url: string }
    const run = await $fetch<Run | null>('/api/force-deploy/status', { query: { branch, sha, since } })
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
    const res = await $fetch<{ ok: boolean; sha?: string; url?: string }>('/api/force-deploy', { method: 'POST', body: { branch } })
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

function isFdBusy(uid: string): boolean {
  const phantom = pendingDeployments.value.find(d => d._originUid === uid)
  return !!phantom && phantom.state !== 'ERROR'
}
</script>

<template>
  <div class="max-w-[1400px] mx-auto py-8 px-6 text-text-primary min-h-screen">
    <!-- Header -->
    <header class="flex items-center justify-between flex-wrap gap-4 mb-4">
      <div class="flex items-center gap-2.5">
        <div class="flex items-center gap-2">
          <!-- Project Logo / Avatar -->
          <div
            class="w-6 h-6 rounded-md bg-gradient-to-br from-blue-main to-purple-600 flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-wider shrink-0"
          >
            {{ project?.name ? project.name.slice(0, 2) : 'VP' }}
          </div>
          <span class="text-[18px] font-semibold tracking-[-0.02em] text-text-primary">{{ project?.name ?? '—' }}</span>
        </div>
        <span v-if="data" class="bg-border-secondary border border-border-primary rounded-full text-text-secondary text-xs font-medium px-2 py-[1px]">
          {{ filteredDeployments.length }}
        </span>
      </div>
      <div class="flex items-center gap-[10px] flex-wrap">
        <!-- Theme Toggle -->
        <button
          class="inline-flex items-center bg-card border border-border-primary rounded-[6px] text-text-secondary cursor-pointer text-sm p-2 transition-colors hover:text-text-primary hover:bg-btn"
          @click="toggleTheme"
          :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        >
          <Icon :name="isDark ? 'lucide:sun' : 'lucide:moon'" class="h-4 w-4" />
        </button>

        <button
          class="inline-flex items-center bg-card border border-border-primary rounded-[6px] text-text-tertiary cursor-pointer text-sm gap-1.5 px-3 py-[6.4px] transition-colors hover:bg-red-bg hover:border-red-border hover:text-red-text"
          @click="logout"
        >
          Logout
        </button>
      </div>
    </header>

    <!-- Filter and Controls bar -->
    <div v-if="data" class="flex justify-between items-center flex-wrap gap-4 mb-4">
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Search input -->
        <input
          ref="searchInput"
          v-model="search"
          type="search"
          placeholder="Search branch, commit, author… (⌘K)"
          aria-label="Search deployments"
          class="bg-input border border-border-primary focus:border-border-focus rounded-[6px] text-text-primary text-[13px] outline-none px-3 py-[6.4px] transition-colors placeholder-text-quaternary w-[300px]"
        />

        <!-- Status select -->
        <select
          v-model="filterStatus"
          class="appearance-none bg-input border focus:border-border-focus hover:border-border-focus rounded-[6px] cursor-pointer text-[13px] outline-none pl-3 pr-8 py-[6.4px] transition-colors bg-[right_0.6rem_center] bg-no-repeat select-custom-arrow"
          :class="[ filterStatus ? 'border-blue-main text-text-primary' : 'border-border-primary text-text-secondary' ]"
        >
          <option value="">All statuses</option>
          <option v-for="s in uniqueStatuses" :key="s" :value="s">{{ s }}</option>
        </select>

        <!-- Author select -->
        <select
          v-model="filterAuthor"
          class="appearance-none bg-input border focus:border-border-focus hover:border-border-focus rounded-[6px] cursor-pointer text-[13px] outline-none pl-3 pr-8 py-[6.4px] transition-colors bg-[right_0.6rem_center] bg-no-repeat select-custom-arrow"
          :class="[ filterAuthor ? 'border-blue-main text-text-primary' : 'border-border-primary text-text-secondary' ]"
        >
          <option value="">All authors</option>
          <option v-for="a in uniqueAuthors" :key="a" :value="a">{{ a }}</option>
        </select>

        <!-- Clear filters button -->
        <button
          v-if="hasFilters"
          @click="clearFilters"
          class="inline-flex items-center bg-card border border-red-border rounded-[6px] text-red-text cursor-pointer text-[13px] gap-1.5 px-3 py-[6.4px] transition-colors hover:bg-red-bg hover:border-red-main"
        >
          ✕ Clear
        </button>
      </div>

      <div class="flex items-center gap-[10px] h-fit">
        <!-- Refresh button -->
        <button
          class="inline-flex items-center bg-card border border-border-primary rounded-[6px] text-text-primary cursor-pointer text-sm gap-1.5 px-3 py-[6.4px] transition-colors hover:not-disabled:bg-btn hover:not-disabled:border-border-focus disabled:opacity-50 disabled:cursor-default"
          :disabled="pending"
          @click="refresh"
        >
          <Icon name="lucide:refresh-cw" class="h-3.5 w-3.5" :class="{ 'animate-spin': pending }" />
          <span>Refresh</span>
        </button>

        <!-- Deploy a Branch button -->
        <button
          class="inline-flex items-center bg-blue-main border border-blue-main rounded-[6px] text-white cursor-pointer text-sm gap-1.5 px-3 py-[6.4px] transition-colors hover:bg-blue-main-hover hover:border-blue-main-hover"
          @click="openDeployBranchDialog"
        >
          <Icon name="lucide:rocket" class="h-4 w-4" />
          <span>Deploy a Branch</span>
        </button>
      </div>
    </div>

    <!-- Loading / Empty states -->
    <div v-if="pending && !data" class="flex flex-col items-center justify-center py-20 text-text-tertiary text-[15px] gap-3">
      <Icon name="lucide:loader-2" class="animate-spin h-6 w-6 text-zinc-500" />
      <span>Loading deployments…</span>
    </div>

    <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-red-text text-[15px] gap-3">
      <Icon name="lucide:alert-triangle" class="h-6 w-6 text-rose-500" />
      <span>{{ error.message }}</span>
    </div>

    <div v-else-if="!filteredDeployments.length" class="flex flex-col items-center justify-center py-20 text-text-tertiary text-[15px] gap-3">
      <span>No deployments found{{ hasFilters ? ' for the active filters' : '' }}.</span>
    </div>

    <!-- Deployments Table -->
    <div v-else class="border border-border-secondary rounded-[8px] overflow-x-auto">
      <table class="table-auto border-collapse text-sm w-full">
        <thead>
          <tr class="border-b border-border-secondary">
            <th scope="col" class="text-text-tertiary text-[11px] font-medium tracking-[0.06em] px-4 py-2.5 text-left uppercase whitespace-nowrap">
              <div class="flex items-center gap-1.5">
                <button
                  class="inline-flex items-center bg-transparent border border-transparent rounded-[4px] text-text-quaternary cursor-pointer shrink-0 p-[2.4px] transition-colors hover:bg-btn hover:border-border-primary hover:text-text-secondary"
                  :class="{ 'bg-btn border-border-primary text-text-primary': collapsed }"
                  :title="collapsed ? 'Expand branches (show all deployments)' : 'Collapse branches (latest per branch)'"
                  @click.stop="collapsed = !collapsed"
                >
                  <Icon v-if="collapsed" name="lucide:fold-vertical" class="h-3.5 w-3.5" />
                  <Icon v-else name="lucide:unfold-vertical" class="h-3.5 w-3.5" />
                </button>
                <span>Branch / Commit</span>
              </div>
            </th>
            <th scope="col" class="text-text-tertiary text-[11px] font-medium tracking-[0.06em] px-4 py-2.5 text-left uppercase whitespace-nowrap">Status</th>
            <th scope="col" class="text-text-tertiary text-[11px] font-medium tracking-[0.06em] px-4 py-2.5 text-left uppercase whitespace-nowrap">Created At</th>
            <th scope="col" class="text-text-tertiary text-[11px] font-medium tracking-[0.06em] px-4 py-2.5 text-left uppercase whitespace-nowrap">Commit Author</th>
            <th scope="col" class="text-text-tertiary text-[11px] font-medium tracking-[0.06em] px-4 py-2.5 text-left uppercase whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(d, idx) in filteredDeployments"
            :key="d.uid"
            class="clickable-row group"
            :class="[
              d._pending ? 'cursor-default bg-orange-bg/20 hover:bg-orange-bg/30' : 'cursor-pointer hover:bg-row-hover'
            ]"
            @click="!d._pending && (inspectingUid = d.uid)"
            @keydown.enter="!d._pending && (inspectingUid = d.uid)"
            :tabindex="d._pending ? -1 : 0"
          >
            <!-- Branch / Commit Info -->
            <td class="border-b border-border-secondary group-last:border-b-0 px-4 py-[13px] align-middle">
              <div class="branch-row">
                <span class="text-text-primary font-mono text-[13px] font-normal hover:underline">{{ d.branch }}</span>
                <span v-if="d.target === 'production'" class="bg-blue-bg border border-blue-border rounded-[3px] text-blue-text inline-block text-[11px] tracking-[0.04em] px-1.5 py-[1.6px] ml-1.5">
                  Production
                </span>
              </div>
              <div v-if="d.commitSha" class="flex items-baseline gap-[6.4px] mt-1">
                <code class="bg-btn border border-border-tertiary rounded-[3px] text-text-tertiary shrink-0 font-mono text-xs px-1.5 py-[0.8px]">
                  {{ d.commitSha.slice(0, 7) }}
                </code>
                <button
                  @click="copySha($event, d.commitSha, d.uid)"
                  class="bg-transparent border-0 text-text-quaternary cursor-pointer inline-flex p-[1.6px] transition-colors hover:text-text-secondary"
                  :class="{ 'text-green-text': copied === `${d.uid}-sha` }"
                  :title="copied === `${d.uid}-sha` ? 'Copied!' : 'Copy commit SHA'"
                >
                  <Icon v-if="copied !== `${d.uid}-sha`" name="lucide:copy" class="h-2.5 w-2.5" />
                  <Icon v-else name="lucide:check" class="h-2.5 w-2.5 text-green-text" />
                </button>
                <span class="text-text-tertiary text-[13px] max-w-[300px] truncate" :class="{ 'text-text-tertiary/80 italic': d._pending }">
                  {{ d.commitMessage }}
                </span>
              </div>
            </td>

            <!-- Status -->
            <td class="border-b border-border-secondary group-last:border-b-0 px-4 py-[13px] align-middle">
              <div class="flex items-center gap-2">
                <DeploymentStatusBadge :state="d.state" :pulse="d._pending" />
                
                <button
                  v-if="!d._pending && CANCELLABLE.has(d.state?.toUpperCase())"
                  :disabled="cancelling === d.uid"
                  @click="cancelDeployment($event, d.uid)"
                  class="bg-transparent border border-red-border rounded-[4px] text-red-text cursor-pointer text-[11px] px-1.5 py-[2.4px] whitespace-nowrap transition-colors hover:bg-red-bg hover:border-red-main disabled:opacity-50 disabled:cursor-default"
                >
                  {{ cancelling === d.uid ? '…' : 'Cancel' }}
                </button>
              </div>
            </td>

            <!-- Created At -->
            <td class="border-b border-border-secondary group-last:border-b-0 px-4 py-[13px] align-middle text-sm whitespace-nowrap">
              <div class="text-text-primary font-normal leading-none mb-1">{{ getCreatedAtTime(d.createdAt) }}</div>
              <div class="text-text-tertiary text-xs font-normal" v-if="d.createdAt">{{ getCreatedAtDate(d.createdAt) }}</div>
            </td>

            <!-- Commit Author -->
            <td class="border-b border-border-secondary group-last:border-b-0 px-4 py-[13px] align-middle">
              <div class="flex items-center gap-1.5">
                <img
                  v-if="d.commitAuthor && !avatarErrors[d.uid] && !d.commitAuthor.includes('bot')"
                  :src="`https://github.com/${d.commitAuthor.replace(/\[bot\]$/, '')}.png?size=32`"
                  :alt="d.commitAuthor"
                  @error="avatarErrors[d.uid] = true"
                  class="rounded-full h-4 w-4 ring-1 ring-border-primary"
                />
                <div v-else-if="d.commitAuthor" class="w-4 h-4 rounded-full bg-card flex items-center justify-center text-text-tertiary">
                  <Icon name="ri:github-fill" class="size-12" />
                </div>
                <span class="text-text-secondary text-sm whitespace-nowrap" >{{ d.commitAuthor || '—' }}</span>
              </div>
            </td>

            <!-- Actions -->
            <td class="border-b border-border-secondary group-last:border-b-0 px-4 py-[13px] align-middle" @click.stop>
              <div class="flex items-center gap-2">
                <template v-if="d._pending">
                  <div v-if="!d._githubRunUrl && d.state !== 'ERROR'" class="p-[2.4px]">
                    <Icon name="lucide:loader-2" class="animate-spin h-3.5 w-3.5 text-zinc-500" />
                  </div>
                  <a
                    v-else-if="d._githubRunUrl"
                    :href="d._githubRunUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-block text-[10px] font-semibold tracking-wide border rounded-[4px] px-2 py-[2.4px] transition-colors"
                    :class="d.state === 'ERROR' ? 'bg-red-bg border-red-border text-red-text hover:bg-red-bg/80' : 'bg-orange-bg border-orange-border text-orange-text hover:bg-orange-bg/80'"
                  >
                    {{ d.state === 'ERROR' ? 'View failure ↗' : 'View run ↗' }}
                  </a>
                </template>

                <template v-else>
                  <!-- Deploy button -->

                  <span v-if="fdErrors[d.uid]" class="inline-block text-[10px] font-semibold bg-red-bg border border-red-border text-red-text rounded-[4px] px-2 py-[2.4px]" :title="fdErrors[d.uid]">
                    Error
                  </span>

                  <!-- GitHub PR link icon button -->
                  <a
                    v-if="d.prUrl"
                    :href="d.prUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center justify-center bg-btn border border-border-tertiary rounded-[4px] text-text-secondary cursor-pointer p-[5px] transition-colors hover:bg-btn-hover hover:border-border-focus hover:text-text-primary"
                    title="View GitHub Pull Request"
                  >
                    <Icon name="ri:github-fill" class="h-[15px] w-[15px]" />
                  </a>
                  <div
                    v-else
                    class="inline-flex items-center justify-center bg-btn border border-border-tertiary rounded-[4px] text-text-quaternary opacity-30 p-[5px]"
                    title="No PR linked"
                  >
                    <Icon name="ri:github-fill" class="h-[15px] w-[15px]" />
                  </div>

                  <!-- Jira Issue link icon button -->
                  <a
                    v-if="getJiraUrl(d.branch)"
                    :href="getJiraUrl(d.branch)!"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center justify-center bg-btn border border-border-tertiary rounded-[4px] text-text-secondary cursor-pointer p-[5px] transition-colors hover:bg-btn-hover hover:border-border-focus hover:text-text-primary"
                    title="View Jira Ticket"
                  >
                    <Icon name="logos:jira" class="h-[15px] w-[15px]" />
                  </a>
                  <div
                    v-else
                    class="inline-flex items-center justify-center bg-btn border border-border-tertiary rounded-[4px] text-text-quaternary opacity-30 p-[5px]"
                    title="No Jira ticket"
                  >
                    <Icon name="logos:jira" class="h-[15px] w-[15px]" />
                  </div>

                  <button
                    :disabled="!d.branch || !DEPLOYABLE.has(d.state?.toUpperCase()) || isFdBusy(d.uid)"
                    :title="!d.branch || !DEPLOYABLE.has(d.state?.toUpperCase()) ? 'Not available' : `Deploy ${d.branch}`"
                    @click="d.branch && DEPLOYABLE.has(d.state?.toUpperCase()) && forceDeploy($event, d.uid, d.branch!)"
                    class="inline-flex items-center bg-btn border border-border-tertiary rounded-[4px] text-text-secondary cursor-pointer text-[13px] gap-1.5 px-3 py-[3px] font-medium transition-colors hover:enabled:bg-btn-hover hover:enabled:border-border-focus hover:enabled:text-text-primary disabled:opacity-40 disabled:cursor-default"
                  >
                    <Icon name="lucide:rocket" class="h-3.5 w-3.5" />
                    <span>Deploy</span>
                  </button>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modals -->
    <DeployBranchDialog
      v-model="deployBranchDialog.open"
      :initial-branch="deployBranchDialog.selectedBranch"
      @deploy="handleDeployBranch"
    />

    <ConfirmForceDeployDialog
      :model-value="!!confirmPending"
      :branch="confirmPending?.branch ?? ''"
      @update:model-value="val => { if (!val) confirmPending = null }"
      @confirm="confirmForceDeploy"
    />

    <DeploymentDetailDrawer
      :uid="inspectingUid"
      @close="inspectingUid = null"
    />
  </div>
</template>

<style scoped>
.select-custom-arrow {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2050/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23555'/%3E%3C/svg%3E");
}
</style>
