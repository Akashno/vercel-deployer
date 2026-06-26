<script setup lang="ts">
interface DeploymentDetail {
  uid: string
  name: string
  state: string
  url: string
  target: string | null
  createdAt: number | null
  buildingAt: number | null
  readyAt: number | null
  buildDurationMs: number | null
  inspectorUrl: string | null
  branch: string | null
  commitSha: string | null
  commitMessage: string | null
  commitAuthor: string | null
  repoUrl: string | null
  prId: string | null
  ghOrg: string | null
  ghRepo: string | null
  regions: string[]
  creator: string | null
}

interface GhCheck { name: string; status: string; conclusion: string | null }
interface GhPr {
  number: number
  title: string
  state: string
  merged: boolean
  additions: number
  deletions: number
  changedFiles: number
  url: string
  baseBranch: string | null
  labels: { name: string; color: string }[]
  reviews: { approved: number; changesRequested: number }
  checks: GhCheck[]
}

interface JiraIssue {
  key: string
  summary: string
  status: string | null
  statusCategory: string | null
  type: string | null
  priority: string | null
  assignee: { name: string; avatar: string | null } | null
  reporter: string | null
  labels: string[]
  sprint: string | null
  storyPoints: number | null
  url: string
}

const route = useRoute()
const uid = route.params.uid as string

const { data, pending, error, refresh } = await useFetch<DeploymentDetail>(`/api/deployments/${uid}`)

const CANCELLABLE = new Set(['BUILDING', 'QUEUED', 'INITIALIZING'])
const cancelling = ref(false)

async function cancelDeployment() {
  cancelling.value = true
  try {
    await $fetch(`/api/deployments/${uid}/cancel`, { method: 'PATCH' })
    await refresh()
  } finally {
    cancelling.value = false
  }
}

const dtf = new Intl.DateTimeFormat('en', {
  month: 'short', day: 'numeric',
  hour: '2-digit', minute: '2-digit',
  hour12: false,
})

function formatTs(ts: number | null): string {
  return ts ? dtf.format(new Date(ts)) : ''
}

function formatDuration(ms: number | null): string {
  if (!ms) return ''
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

// ── GitHub PR + Jira integrations ────────────────────────────────────────────
const JIRA_KEY_RE = /([A-Z]+-\d+)/
const jiraKey = computed(() => {
  const m = data.value?.branch?.match(JIRA_KEY_RE)
  return m ? m[1] : null
})

const ghPr = ref<GhPr | null>(null)
const ghPrPending = ref(false)
const ghPrError = ref(false)

const jiraIssue = ref<JiraIssue | null>(null)
const jiraPending = ref(false)
const jiraError = ref(false)

onMounted(async () => {
  const d = data.value
  if (!d) return
  const fetches: Promise<void>[] = []

  if (d.prId && d.ghOrg && d.ghRepo) {
    ghPrPending.value = true
    fetches.push(
      $fetch<GhPr>('/api/github/pr', { query: { owner: d.ghOrg, repo: d.ghRepo, pr: d.prId, sha: d.commitSha ?? '' } })
        .then(r => { ghPr.value = r })
        .catch(() => { ghPrError.value = true })
        .finally(() => { ghPrPending.value = false }),
    )
  }

  if (jiraKey.value) {
    jiraPending.value = true
    fetches.push(
      $fetch<JiraIssue>('/api/jira/issue', { query: { key: jiraKey.value } })
        .then(r => { jiraIssue.value = r })
        .catch(() => { jiraError.value = true })
        .finally(() => { jiraPending.value = false }),
    )
  }

  await Promise.all(fetches)
})

function prStateLabel(pr: GhPr) {
  if (pr.merged) return 'Merged'
  return pr.state === 'open' ? 'Open' : 'Closed'
}

function prStateClass(pr: GhPr) {
  if (pr.merged) return 'bg-purple-500/10 border-purple-500/20 text-purple-400'
  return pr.state === 'open'
    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
    : 'bg-zinc-800 border-zinc-700 text-zinc-400'
}

function jiraStatusClass(issue: JiraIssue) {
  const cat = issue.statusCategory
  if (cat === 'done') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
  if (cat === 'indeterminate') return 'bg-blue-500/10 border-blue-500/20 text-blue-400'
  return 'bg-zinc-800 border-zinc-700 text-zinc-400'
}

function openLink(url: string) {
  window.open(url, '_blank', 'noopener')
}

const copied = ref<string | null>(null)

async function copy(value: string, key: string) {
  await navigator.clipboard.writeText(value)
  copied.value = key
  setTimeout(() => { copied.value = null }, 1500)
}

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

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
})
</script>

<template>
  <div class="max-w-[1000px] mx-auto py-8 px-6 text-text-primary min-h-screen">
    <!-- Breadcrumb & Theme Toggle -->
    <nav class="mb-6 flex justify-between items-center">
      <NuxtLink to="/" class="text-text-tertiary text-sm no-underline hover:text-text-secondary transition-colors">← Deployments</NuxtLink>
      <!-- Theme Toggle -->
      <button
        class="inline-flex items-center bg-card border border-border-primary rounded-[6px] text-text-secondary cursor-pointer text-sm p-2 transition-colors hover:text-text-primary hover:bg-btn"
        @click="toggleTheme"
        :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
      >
        <Icon :name="isDark ? 'lucide:sun' : 'lucide:moon'" class="h-4 w-4" />
      </button>
    </nav>

    <!-- Loading / Error states -->
    <div v-if="pending" class="flex flex-col items-center justify-center py-20 text-text-tertiary text-[15px] gap-3">
      <div class="animate-[spin_0.7s_linear_infinite] border-2 border-border-tertiary border-t-border-focus rounded-full h-6 w-6" />
      <span>Loading deployment…</span>
    </div>

    <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-red-text text-[15px] gap-3">
      <span class="text-2xl">⚠</span>
      <span>{{ error.message }}</span>
    </div>

    <!-- Detail Content -->
    <template v-else-if="data">
      <!-- Header -->
      <div class="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div class="flex items-center gap-3 flex-wrap">
          <DeploymentStatusBadge :state="data.state" />
          <h1 class="text-[20px] font-semibold tracking-[-0.02em] text-text-primary">{{ data.name }}</h1>
          <span v-if="data.target === 'production'" class="bg-blue-bg border border-blue-border rounded-[3px] text-blue-text text-[11px] tracking-[0.04em] px-1.5 py-[1.6px]">
            Production
          </span>
        </div>
        <div class="flex gap-2 shrink-0">
          <a :href="`https://${data.url}`" target="_blank" rel="noopener" class="bg-blue-main border border-blue-main rounded-[6px] text-white text-[13px] px-3 py-[6.4px] no-underline transition-colors hover:bg-blue-main-hover hover:border-blue-main-hover">
            Visit ↗
          </a>
          <a v-if="data.inspectorUrl" :href="data.inspectorUrl" target="_blank" rel="noopener" class="border border-border-primary rounded-[6px] text-text-secondary text-[13px] px-3 py-[6.4px] no-underline transition-colors hover:border-border-focus hover:text-text-primary hover:bg-btn">
            Vercel Dashboard ↗
          </a>
          <button
            v-if="CANCELLABLE.has(data.state?.toUpperCase())"
            :disabled="cancelling"
            @click="cancelDeployment"
            class="bg-transparent border border-red-border rounded-[6px] text-red-text text-[13px] px-3 py-[6.4px] transition-colors hover:bg-red-bg hover:border-red-main"
          >
            {{ cancelling ? 'Cancelling…' : 'Cancel Deployment' }}
          </button>
        </div>
      </div>

      <!-- Meta Strip -->
      <div class="bg-card border border-border-secondary rounded-[8px] px-4 py-[14px] mb-6 flex flex-col gap-2">
        <!-- Row 1: URL -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-text-quaternary text-[11px] font-medium tracking-[0.05em] uppercase w-20 shrink-0">Preview URL</span>
          <a :href="`https://${data.url}`" target="_blank" rel="noopener" class="text-text-primary font-mono text-sm no-underline hover:underline hover:text-text-primary">{{ data.url }}</a>
          <button
            @click="copy(data.url, 'url')"
            class="bg-transparent border border-border-primary rounded-[4px] text-text-tertiary text-[11px] px-1.5 py-[1.6px] transition-colors hover:border-border-focus hover:text-text-secondary"
            :class="{ 'border-green-border text-green-text': copied === 'url' }"
          >
            {{ copied === 'url' ? 'Copied!' : 'Copy' }}
          </button>
        </div>

        <!-- Row 2: Branch -->
        <div v-if="data.branch" class="flex items-center gap-1.5 flex-wrap">
          <span class="text-text-quaternary text-[11px] font-medium tracking-[0.05em] uppercase w-20 shrink-0">Branch</span>
          <a v-if="data.repoUrl" :href="`${data.repoUrl}/tree/${data.branch}`" target="_blank" rel="noopener" class="text-text-secondary font-mono text-[13px] no-underline hover:underline hover:text-text-primary">{{ data.branch }}</a>
          <span v-else class="text-text-secondary font-mono text-[13px]">{{ data.branch }}</span>
          <button
            @click="copy(data.branch, 'branch')"
            class="bg-transparent border border-border-primary rounded-[4px] text-text-tertiary text-[10px] px-1.2 py-[0.8px] transition-colors hover:border-border-focus hover:text-text-secondary"
            :class="{ 'border-green-border text-green-text': copied === 'branch' }"
          >
            {{ copied === 'branch' ? '✓' : 'Copy' }}
          </button>
        </div>

        <!-- Row 3: Commit -->
        <div v-if="data.commitSha" class="flex items-center gap-1.5 flex-wrap">
          <span class="text-text-quaternary text-[11px] font-medium tracking-[0.05em] uppercase w-20 shrink-0">Commit ID</span>
          <a v-if="data.repoUrl" :href="`${data.repoUrl}/commit/${data.commitSha}`" target="_blank" rel="noopener" class="bg-btn border border-border-tertiary rounded-[3px] text-text-tertiary font-mono text-xs px-1.5 py-[0.8px] no-underline hover:text-text-secondary">{{ data.commitSha.slice(0, 7) }}</a>
          <code v-else class="bg-btn border border-border-tertiary rounded-[3px] text-text-tertiary font-mono text-xs px-1.5 py-[0.8px]">{{ data.commitSha.slice(0, 7) }}</code>
          <button
            @click="copy(data.commitSha, 'sha')"
            class="bg-transparent border border-border-primary rounded-[4px] text-text-tertiary text-[10px] px-1.2 py-[0.8px] transition-colors hover:border-border-focus hover:text-text-secondary"
            :class="{ 'border-green-border text-green-text': copied === 'sha' }"
          >
            {{ copied === 'sha' ? '✓' : 'Copy' }}
          </button>
          <span v-if="data.commitMessage" class="text-text-quaternary text-[13px] font-mono select-none">·</span>
          <span v-if="data.commitMessage" class="text-text-tertiary text-[13px] max-w-[400px] truncate" :title="data.commitMessage">{{ data.commitMessage }}</span>
        </div>

        <!-- Row 4: Author -->
        <div v-if="data.commitAuthor || formatTs(data.createdAt)" class="flex items-center gap-1.5 flex-wrap">
          <span class="text-text-quaternary text-[11px] font-medium tracking-[0.05em] uppercase w-20 shrink-0">Author</span>
          <span class="text-text-quaternary text-xs">
            {{ [data.commitAuthor, formatTs(data.createdAt), formatDuration(data.buildDurationMs) ? `built in ${formatDuration(data.buildDurationMs)}` : ''].filter(Boolean).join(' · ') }}
          </span>
        </div>
      </div>

      <!-- Integrations Row -->
      <div v-if="data.prId || jiraKey" class="flex gap-[18px] mb-6 flex-col md:flex-row">
        <!-- GitHub Pull Request Card -->
        <div
          v-if="data.prId"
          @click="ghPr && openLink(ghPr.url)"
          class="flex-1 bg-card border border-border-secondary rounded-[8px] px-4 py-[14px] transition-colors hover:border-border-primary"
          :class="{ 'cursor-pointer': !!ghPr }"
        >
          <div class="flex items-center gap-2 mb-3">
            <Icon name="lucide:git-pull-request" class="text-text-quaternary shrink-0 h-3.5 w-3.5" />
            <span class="text-text-quaternary text-[11px] font-medium tracking-[0.06em] uppercase flex-1">GitHub Pull Request</span>
            <div v-if="ghPrPending" class="animate-spin h-2.5 w-2.5 border-1.5 border-border-primary border-t-border-focus rounded-full" />
            <span v-if="ghPr" class="text-text-quaternary text-xs">↗</span>
          </div>

          <div v-if="ghPrPending" class="text-text-quaternary text-[13px] italic">Loading PR details…</div>
          <div v-else-if="ghPrError" class="text-red-text text-[13px]">Failed to load PR details</div>
          
          <template v-else-if="ghPr">
            <div class="flex flex-col">
              <div class="flex items-center gap-3 min-h-[25.6px]">
                <span class="text-text-quaternary shrink-0 text-[11px] font-medium tracking-[0.04em] uppercase w-16">Status</span>
                <span class="border border-transparent rounded-[4px] inline-block text-[10px] font-semibold px-1.5 py-[0.8px] uppercase" :class="prStateClass(ghPr)">{{ prStateLabel(ghPr) }}</span>
              </div>
              <div class="flex items-start gap-3 min-h-[25.6px] border-t border-border-secondary mt-1.5 pt-1.5">
                <span class="text-text-quaternary shrink-0 text-[11px] font-medium tracking-[0.04em] uppercase w-16">PR</span>
                <span class="text-text-secondary text-[13px] leading-relaxed">#{{ ghPr.number }} {{ ghPr.title }}</span>
              </div>
              <div class="flex items-center gap-3 min-h-[25.6px] border-t border-border-secondary mt-1.5 pt-1.5">
                <span class="text-text-quaternary shrink-0 text-[11px] font-medium tracking-[0.04em] uppercase w-16">Review</span>
                <span v-if="ghPr.reviews.approved" class="text-green-text text-[13px] font-medium">✓ {{ ghPr.reviews.approved }} approved</span>
                <span v-else-if="ghPr.reviews.changesRequested" class="text-red-text text-[13px] font-medium">✗ Changes requested</span>
                <span v-else class="text-text-tertiary text-[13px]">Pending</span>
              </div>
              <div v-if="ghPr.labels.length" class="flex items-start gap-3 min-h-[25.6px] border-t border-border-secondary mt-1.5 pt-1.5">
                <span class="text-text-quaternary shrink-0 text-[11px] font-medium tracking-[0.04em] uppercase w-16">Labels</span>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="l in ghPr.labels"
                    :key="l.name"
                    class="border border-transparent rounded-[4px] inline-block text-[10px] font-semibold px-1.5 py-[0.8px] uppercase"
                    :style="{ background: `#${l.color}15`, borderColor: `#${l.color}35`, color: `#${l.color}` }"
                  >
                    {{ l.name }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Jira Card -->
        <div
          v-if="jiraKey"
          @click="jiraIssue && openLink(jiraIssue.url)"
          class="flex-1 bg-card border border-border-secondary rounded-[8px] px-4 py-[14px] transition-colors hover:border-border-primary"
          :class="{ 'cursor-pointer': !!jiraIssue }"
        >
          <div class="flex items-center gap-2 mb-3">
            <Icon name="logos:jira" class="text-text-quaternary shrink-0 h-3.5 w-3.5" />
            <span class="text-text-quaternary text-[11px] font-medium tracking-[0.06em] uppercase flex-1">Jira</span>
            <div v-if="jiraPending" class="animate-spin h-2.5 w-2.5 border-1.5 border-border-primary border-t-border-focus rounded-full" />
            <span v-if="jiraIssue" class="text-text-quaternary text-xs">↗</span>
          </div>

          <div v-if="jiraPending" class="text-text-quaternary text-[13px] italic">Loading issue details…</div>
          <div v-else-if="jiraError" class="text-red-text text-[13px]">Failed to load Jira issue</div>

          <template v-else-if="jiraIssue">
            <div class="flex flex-col">
              <div class="flex items-center gap-3 min-h-[25.6px]">
                <span class="text-text-quaternary shrink-0 text-[11px] font-medium tracking-[0.04em] uppercase w-16">Status</span>
                <span class="border border-transparent rounded-[4px] inline-block text-[10px] font-semibold px-1.5 py-[0.8px] uppercase" :class="jiraStatusClass(jiraIssue)">{{ jiraIssue.status }}</span>
              </div>
              <div class="flex items-start gap-3 min-h-[25.6px] border-t border-border-secondary mt-1.5 pt-1.5">
                <span class="text-text-quaternary shrink-0 text-[11px] font-medium tracking-[0.04em] uppercase w-16">Issue</span>
                <span class="text-text-secondary text-[13px] leading-relaxed">
                  <span class="text-blue-text font-mono text-xs font-semibold mr-1.5 uppercase select-all">{{ jiraIssue.key }}</span>
                  {{ jiraIssue.summary }}
                </span>
              </div>
              <div v-if="jiraIssue.type || jiraIssue.priority" class="flex items-center gap-3 min-h-[25.6px] border-t border-border-secondary mt-1.5 pt-1.5">
                <span class="text-text-quaternary shrink-0 text-[11px] font-medium tracking-[0.04em] uppercase w-16">Type</span>
                <div class="flex items-center gap-1.5">
                  <span v-if="jiraIssue.type" class="bg-btn border border-border-tertiary rounded-[3px] text-text-secondary text-[11px] font-medium px-1.5 py-[0.8px]">{{ jiraIssue.type }}</span>
                  <span v-if="jiraIssue.priority" class="bg-btn border border-border-tertiary rounded-[3px] text-text-secondary text-[11px] font-medium px-1.5 py-[0.8px]">{{ jiraIssue.priority }}</span>
                </div>
              </div>
              <div v-if="jiraIssue.assignee" class="flex items-center gap-3 min-h-[25.6px] border-t border-border-secondary mt-1.5 pt-1.5">
                <span class="text-text-quaternary shrink-0 text-[11px] font-medium tracking-[0.04em] uppercase w-16">Assignee</span>
                <div class="flex items-center gap-1.5">
                  <img v-if="jiraIssue.assignee.avatar" :src="jiraIssue.assignee.avatar" class="rounded-full h-4 w-4" />
                  <span class="text-text-secondary text-[13px] leading-relaxed">{{ jiraIssue.assignee.name }}</span>
                </div>
              </div>
              <div v-if="jiraIssue.sprint" class="flex items-center gap-3 min-h-[25.6px] border-t border-border-secondary mt-1.5 pt-1.5">
                <span class="text-text-quaternary shrink-0 text-[11px] font-medium tracking-[0.04em] uppercase w-16">Sprint</span>
                <span class="text-text-secondary text-[13px] leading-relaxed">{{ jiraIssue.sprint }}</span>
              </div>
              <div v-if="jiraIssue.storyPoints" class="flex items-center gap-3 min-h-[25.6px] border-t border-border-secondary mt-1.5 pt-1.5">
                <span class="text-text-quaternary shrink-0 text-[11px] font-medium tracking-[0.04em] uppercase w-16">Points</span>
                <span class="text-text-secondary text-[13px] leading-relaxed">{{ jiraIssue.storyPoints }}</span>
              </div>
              <div v-if="jiraIssue.labels.length" class="flex items-start gap-3 min-h-[25.6px] border-t border-border-secondary mt-1.5 pt-1.5">
                <span class="text-text-quaternary shrink-0 text-[11px] font-medium tracking-[0.04em] uppercase w-16">Labels</span>
                <div class="flex flex-wrap gap-1">
                  <span v-for="l in jiraIssue.labels" :key="l" class="bg-btn border border-border-tertiary rounded-[3px] text-text-secondary text-[11px] font-medium px-1.5 py-[0.8px]">{{ l }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Build Logs (LogViewer component) -->
      <LogViewer :uid="uid" />
    </template>
  </div>
</template>
