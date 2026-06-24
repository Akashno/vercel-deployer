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

interface LogLine {
  type: string
  text: string
  date: number | null
}

const route = useRoute()
const uid = route.params.uid as string

const { data, pending, error } = await useFetch<DeploymentDetail>(`/api/deployments/${uid}`)

const isLogsOpen = ref(false)
const { data: logs, pending: logsPending, execute: fetchLogs } = useFetch<LogLine[]>(
  `/api/deployments/${uid}/logs`,
  { immediate: false, server: false },
)

const logsTerminal = ref<HTMLElement | null>(null)
const logSearch = ref('')

const filteredLogs = computed(() => {
  if (!logs.value) return []
  const q = logSearch.value.toLowerCase().trim()
  if (!q) return logs.value
  return logs.value.filter(l => l.text.toLowerCase().includes(q))
})

function highlight(text: string): string {
  const q = logSearch.value.trim()
  if (!q) return escapeHtml(text)
  const escaped = escapeHtml(text)
  const escapedQ = escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return escaped.replace(new RegExp(escapedQ, 'gi'), m => `<mark class="log-highlight">${m}</mark>`)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const errorIndices = computed(() =>
  filteredLogs.value.reduce<number[]>((acc, l, i) => {
    if (l.type === 'stderr') acc.push(i)
    return acc
  }, [])
)

const warnIndices = computed(() =>
  filteredLogs.value.reduce<number[]>((acc, l, i) => {
    if (l.type !== 'stderr' && l.text.toLowerCase().includes('warn')) acc.push(i)
    return acc
  }, [])
)

const errorCursor = ref(0)
const warnCursor = ref(0)

watch(filteredLogs, () => { errorCursor.value = 0; warnCursor.value = 0 })

function scrollToLine(lineIndex: number) {
  nextTick(() => {
    if (!logsTerminal.value) return
    const lines = logsTerminal.value.querySelectorAll<HTMLElement>('.log-line')
    lines[lineIndex]?.scrollIntoView({ block: 'center' })
  })
}

function navigateError(dir: 1 | -1) {
  if (!errorIndices.value.length) return
  errorCursor.value = (errorCursor.value + dir + errorIndices.value.length) % errorIndices.value.length
  scrollToLine(errorIndices.value[errorCursor.value])
}

function navigateWarn(dir: 1 | -1) {
  if (!warnIndices.value.length) return
  warnCursor.value = (warnCursor.value + dir + warnIndices.value.length) % warnIndices.value.length
  scrollToLine(warnIndices.value[warnCursor.value])
}

function scrollToBottom() {
  nextTick(() => {
    if (logsTerminal.value) logsTerminal.value.scrollTop = logsTerminal.value.scrollHeight
  })
}

async function toggleLogs() {
  isLogsOpen.value = !isLogsOpen.value
  if (isLogsOpen.value && !logs.value) {
    await fetchLogs()
    scrollToBottom()
  } else if (isLogsOpen.value) {
    scrollToBottom()
  }
}

watch(logsPending, (pending) => {
  if (!pending && isLogsOpen.value) scrollToBottom()
})

const CANCELLABLE = new Set(['BUILDING', 'QUEUED', 'INITIALIZING'])
const cancelling = ref(false)

async function cancelDeployment() {
  cancelling.value = true
  try {
    await $fetch(`/api/deployments/${uid}/cancel`, { method: 'PATCH' })
    await refreshNuxtData()
  } finally {
    cancelling.value = false
  }
}

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
  if (pr.merged) return 'pr-merged'
  return pr.state === 'open' ? 'pr-open' : 'pr-closed'
}

function checkIcon(c: GhCheck) {
  if (c.status !== 'completed') return '●'
  if (c.conclusion === 'success') return '✓'
  if (c.conclusion === 'skipped' || c.conclusion === 'neutral') return '○'
  return '✗'
}
function checkClass(c: GhCheck) {
  if (c.status !== 'completed') return 'check-pending'
  if (c.conclusion === 'success') return 'check-success'
  if (c.conclusion === 'skipped' || c.conclusion === 'neutral') return 'check-skipped'
  return 'check-fail'
}

function jiraStatusClass(issue: JiraIssue) {
  const cat = issue.statusCategory
  if (cat === 'done') return 'jira-done'
  if (cat === 'indeterminate') return 'jira-inprogress'
  return 'jira-todo'
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
</script>

<template>
  <div class="page">
    <nav class="breadcrumb">
      <NuxtLink to="/" class="back-link">← Deployments</NuxtLink>
    </nav>

    <div v-if="pending" class="empty-state">
      <div class="spinner" />
      <span>Loading deployment…</span>
    </div>

    <div v-else-if="error" class="empty-state error-state">
      <span class="error-icon">⚠</span>
      <span>{{ error.message }}</span>
    </div>

    <template v-else-if="data">
      <!-- Header -->
      <div class="detail-header">
        <div class="detail-title-row">
          <span :class="['badge', getBadgeClass(data.state)]">{{ data.state }}</span>
          <h1 class="detail-title">{{ data.name }}</h1>
          <span v-if="data.target === 'production'" class="prod-tag">Production</span>
        </div>
        <div class="detail-actions">
          <a :href="`https://${data.url}`" target="_blank" rel="noopener" class="action-btn primary">Visit ↗</a>
          <a v-if="data.inspectorUrl" :href="data.inspectorUrl" target="_blank" rel="noopener" class="action-btn">Vercel Dashboard ↗</a>
          <button
            v-if="CANCELLABLE.has(data.state?.toUpperCase())"
            class="action-btn cancel-action"
            :disabled="cancelling"
            @click="cancelDeployment"
          >{{ cancelling ? 'Cancelling…' : 'Cancel Deployment' }}</button>
        </div>
      </div>

      <!-- Meta strip -->
      <div class="meta-strip">
        <!-- Row 1: URL -->
        <div class="meta-row">
          <span class="meta-label">Preview URL</span>
          <a :href="`https://${data.url}`" target="_blank" rel="noopener" class="meta-url">{{ data.url }}</a>
          <button class="copy-btn" :class="{ copied: copied === 'url' }" @click="copy(data.url, 'url')">
            {{ copied === 'url' ? 'Copied!' : 'Copy' }}
          </button>
        </div>
        <!-- Row 2: Branch -->
        <div v-if="data.branch" class="meta-row">
          <span class="meta-label">Branch</span>
          <a v-if="data.repoUrl" :href="`${data.repoUrl}/tree/${data.branch}`" target="_blank" rel="noopener" class="git-link">{{ data.branch }}</a>
          <span v-else class="git-value">{{ data.branch }}</span>
          <button class="copy-btn small" :class="{ copied: copied === 'branch' }" @click="copy(data.branch, 'branch')">
            {{ copied === 'branch' ? '✓' : 'Copy' }}
          </button>
        </div>
        <!-- Row 3: Commit SHA + message -->
        <div v-if="data.commitSha" class="meta-row">
          <span class="meta-label">Commit ID</span>
          <a v-if="data.repoUrl" :href="`${data.repoUrl}/commit/${data.commitSha}`" target="_blank" rel="noopener" class="sha-badge">{{ data.commitSha.slice(0, 7) }}</a>
          <code v-else class="sha-badge">{{ data.commitSha.slice(0, 7) }}</code>
          <button class="copy-btn small" :class="{ copied: copied === 'sha' }" @click="copy(data.commitSha, 'sha')">
            {{ copied === 'sha' ? '✓' : 'Copy' }}
          </button>
          <span v-if="data.commitMessage" class="git-sep">·</span>
          <span v-if="data.commitMessage" class="git-msg">{{ data.commitMessage }}</span>
        </div>
        <!-- Row 4: Author + date -->
        <div v-if="data.commitAuthor || formatTs(data.createdAt)" class="meta-row">
          <span class="meta-label">Author</span>
          <span class="git-meta">{{ [data.commitAuthor, formatTs(data.createdAt), formatDuration(data.buildDurationMs) ? `built in ${formatDuration(data.buildDurationMs)}` : ''].filter(Boolean).join(' · ') }}</span>
        </div>
      </div>

      <!-- GitHub PR card -->
       <div style="display: flex; gap: 18px;">
<div v-if="data.prId" class="integration-card"
        :class="{ 'card-clickable': !!ghPr }"
        @click="ghPr && openLink(ghPr.url)">
        <div class="card-header">
          <svg class="card-brand-icon" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span class="card-label">GitHub Pull Request</span>
          <span v-if="ghPrPending" class="card-spinner" />
          <span v-if="ghPr" class="card-ext-link">↗</span>
        </div>
        <div v-if="ghPrPending" class="card-loading">Loading PR details…</div>
        <div v-else-if="ghPrError" class="card-error">Failed to load PR details</div>
        <template v-else-if="ghPr">
          <div class="info-row">
            <span class="info-label">Status</span>
            <span :class="['pr-state-badge', prStateClass(ghPr)]">{{ prStateLabel(ghPr) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">PR</span>
            <span class="info-value">#{{ ghPr.number }} {{ ghPr.title }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Review</span>
            <span v-if="ghPr.reviews.approved" class="review-ok">✓ {{ ghPr.reviews.approved }} approved</span>
            <span v-else-if="ghPr.reviews.changesRequested" class="review-block">✗ Changes requested</span>
            <span v-else class="info-value card-muted">Pending</span>
          </div>
          <div v-if="ghPr.labels.length" class="info-row">
            <span class="info-label">Labels</span>
            <div class="info-chips">
              <span v-for="l in ghPr.labels" :key="l.name" class="gh-label"
                :style="{ background: `#${l.color}20`, borderColor: `#${l.color}40`, color: `#${l.color}` }">
                {{ l.name }}
              </span>
            </div>
          </div>
        </template>
      </div>
<div v-if="jiraKey" class="integration-card"
        :class="{ 'card-clickable': !!jiraIssue }"
        @click="jiraIssue && openLink(jiraIssue.url)">
        <div class="card-header">
          <svg class="card-brand-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M15.976 0C9.79 0 4.938 4.87 4.938 11.08c0 3.504 1.61 6.632 4.14 8.71L15.976 32l6.898-12.21c2.53-2.078 4.14-5.206 4.14-8.71C27.014 4.87 22.162 0 15.976 0zm0 15.953a4.873 4.873 0 1 1 0-9.746 4.873 4.873 0 0 1 0 9.746z" fill="#2684FF"/>
          </svg>
          <span class="card-label">Jira</span>
          <span v-if="jiraPending" class="card-spinner" />
          <span v-if="jiraIssue" class="card-ext-link">↗</span>
        </div>
        <div v-if="jiraPending" class="card-loading">Loading issue details…</div>
        <div v-else-if="jiraError" class="card-error">Failed to load Jira issue</div>
        <template v-else-if="jiraIssue">
          <div class="info-row">
            <span class="info-label">Status</span>
            <span :class="['jira-status-badge', jiraStatusClass(jiraIssue)]">{{ jiraIssue.status }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Issue</span>
            <span class="info-value">
              <span class="jira-key-inline">{{ jiraIssue.key }}</span>{{ jiraIssue.summary }}
            </span>
          </div>
          <div v-if="jiraIssue.type || jiraIssue.priority" class="info-row">
            <span class="info-label">Type</span>
            <div class="info-chips">
              <span v-if="jiraIssue.type" class="meta-pill">{{ jiraIssue.type }}</span>
              <span v-if="jiraIssue.priority" class="meta-pill">{{ jiraIssue.priority }}</span>
            </div>
          </div>
          <div v-if="jiraIssue.assignee" class="info-row">
            <span class="info-label">Assignee</span>
            <img v-if="jiraIssue.assignee.avatar" :src="jiraIssue.assignee.avatar" class="assignee-avatar" />
            <span class="info-value">{{ jiraIssue.assignee.name }}</span>
          </div>
          <div v-if="jiraIssue.sprint" class="info-row">
            <span class="info-label">Sprint</span>
            <span class="info-value">{{ jiraIssue.sprint }}</span>
          </div>
          <div v-if="jiraIssue.storyPoints" class="info-row">
            <span class="info-label">Points</span>
            <span class="info-value">{{ jiraIssue.storyPoints }}</span>
          </div>
          <div v-if="jiraIssue.labels.length" class="info-row">
            <span class="info-label">Labels</span>
            <div class="info-chips">
              <span v-for="l in jiraIssue.labels" :key="l" class="meta-pill">{{ l }}</span>
            </div>
          </div>
        </template>
      </div>
       </div>
      

      <!-- Jira card -->
      

      <!-- Build Logs accordion -->
      <div class="logs-section">
        <button class="logs-toggle" @click="toggleLogs">
          <span class="logs-title">Build Logs</span>
          <span class="logs-toggle-right">
            <span v-if="logsPending" class="logs-loading">
              <span class="spinner-inline" /> fetching…
            </span>
            <span v-else-if="logs" class="logs-count">{{ logs.length }} lines</span>
            <span class="logs-chevron" :class="{ open: isLogsOpen }">›</span>
          </span>
        </button>

        <div v-if="isLogsOpen" class="logs-toolbar">
          <input
            v-model="logSearch"
            class="log-search"
            type="search"
            placeholder="Search logs…"
          />
          <div class="toolbar-right">
            <div v-if="errorIndices.length" class="jump-group jump-group--error">
              <span class="jump-label">{{ errorCursor + 1 }}/{{ errorIndices.length }} errors</span>
              <button class="jump-arrow" title="Previous error" @click="navigateError(-1)"><i class="chevron chevron--up" /></button>
              <button class="jump-arrow" title="Next error" @click="navigateError(1)"><i class="chevron chevron--down" /></button>
            </div>
            <div v-if="warnIndices.length" class="jump-group jump-group--warn">
              <span class="jump-label">{{ warnCursor + 1 }}/{{ warnIndices.length }} warnings</span>
              <button class="jump-arrow" title="Previous warning" @click="navigateWarn(-1)"><i class="chevron chevron--up" /></button>
              <button class="jump-arrow" title="Next warning" @click="navigateWarn(1)"><i class="chevron chevron--down" /></button>
            </div>
            <button class="jump-btn" @click="scrollToBottom">Bottom</button>
          </div>
        </div>

        <div v-if="isLogsOpen" ref="logsTerminal" class="logs-terminal">
          <div v-if="logsPending" class="logs-empty">Loading logs…</div>
          <div v-else-if="!filteredLogs.length" class="logs-empty">
            {{ logSearch ? 'No lines match your search.' : 'No build logs available.' }}
          </div>
          <template v-else>
            <div
              v-for="(line, i) in filteredLogs"
              :key="i"
              :class="['log-line', `log-${line.type}`, { 'log-warn': line.type !== 'stderr' && line.text.toLowerCase().includes('warn') }]"
            >
              <span class="log-text" v-html="highlight(line.text)" />
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.breadcrumb { margin-bottom: 1.5rem; }

.back-link {
  color: #555;
  font-size: 0.875rem;
  text-decoration: none;
  transition: color 0.15s;
}
.back-link:hover { color: #aaa; }

/* Header */
.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.detail-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.detail-title {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #fff;
}

.detail-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.action-btn {
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #ccc;
  font-size: 0.8125rem;
  padding: 0.4rem 0.75rem;
  text-decoration: none;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.action-btn:hover { border-color: #444; color: #fff; background: #111; }
.action-btn.primary { background: #0070f3; border-color: #0070f3; color: #fff; }
.action-btn.primary:hover { background: #005cc5; border-color: #005cc5; }
.action-btn.cancel-action { border-color: rgba(229, 72, 77, 0.4); color: #e5484d; cursor: pointer; }
.action-btn.cancel-action:hover:not(:disabled) { background: rgba(229, 72, 77, 0.08); border-color: #e5484d; }
.action-btn.cancel-action:disabled { opacity: 0.5; cursor: default; }

/* Meta strip */
.meta-strip {
  background: #080808;
  border: 1px solid #1a1a1a;
  border-radius: 8px;
  padding: 0.875rem 1rem;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meta-label {
  color: #444;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  min-width: 80px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.meta-url {
  color: #ededed;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.875rem;
  text-decoration: none;
}
.meta-url:hover { text-decoration: underline; color: #fff; }

.git-icon { color: #555; font-size: 0.875rem; }

.git-link, .git-value {
  color: #aaa;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.8125rem;
  text-decoration: none;
}
.git-link:hover { color: #fff; text-decoration: underline; }

.sha-badge {
  background: #111;
  border: 1px solid #222;
  border-radius: 3px;
  color: #666;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.75rem;
  padding: 0.05rem 0.35rem;
  text-decoration: none;
}
.sha-badge:hover { color: #999; }

.git-sep { color: #333; font-size: 0.8125rem; }

.git-msg {
  color: #666;
  font-size: 0.8125rem;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.git-meta { color: #444; font-size: 0.75rem; }

/* Copy button */
.copy-btn {
  background: transparent;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  color: #555;
  cursor: pointer;
  font-size: 0.6875rem;
  padding: 0.1rem 0.4rem;
  transition: border-color 0.15s, color 0.15s;
  white-space: nowrap;
}
.copy-btn:hover { border-color: #444; color: #aaa; }
.copy-btn.copied { border-color: #00c950; color: #00c950; }
.copy-btn.small { font-size: 0.625rem; padding: 0.05rem 0.3rem; }

/* Build logs */
.logs-section {
  border: 1px solid #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
}

.logs-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: #080808;
  border: none;
  border-bottom: 1px solid transparent;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.15s;
}
.logs-toggle:hover { background: #0d0d0d; }

.logs-section:has(.logs-terminal) .logs-toggle {
  border-bottom-color: #1a1a1a;
}

.logs-toggle-right {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.logs-chevron {
  color: #444;
  font-size: 1.125rem;
  line-height: 1;
  transition: transform 0.2s;
  transform: rotate(0deg);
}
.logs-chevron.open { transform: rotate(90deg); }

.logs-title {
  color: #555;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.logs-count { color: #333; font-size: 0.75rem; }

.logs-loading {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: #444;
  font-size: 0.75rem;
}

.spinner-inline {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 1.5px solid #333;
  border-top-color: #555;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.logs-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: #060606;
  border-bottom: 1px solid #1a1a1a;
}

.log-search {
  background: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 5px;
  color: #ededed;
  font-size: 0.75rem;
  outline: none;
  padding: 0.3rem 0.625rem;
  width: 200px;
  transition: border-color 0.15s;
}
.log-search:focus { border-color: #555; }
.log-search::placeholder { color: #333; }

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-left: auto;
}

.jump-group {
  display: flex;
  align-items: center;
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid #2a2a2a;
}

.jump-group--error .jump-label { color: #e5484d; }
.jump-group--error .jump-arrow { color: #e5484d; }
.jump-group--error .jump-arrow:hover { background: rgba(229, 72, 77, 0.1); }

.jump-group--warn .jump-label { color: #e5a60a; }
.jump-group--warn .jump-arrow { color: #e5a60a; }
.jump-group--warn .jump-arrow:hover { background: rgba(229, 166, 10, 0.1); }

.jump-label {
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  white-space: nowrap;
  border-right: 1px solid #2a2a2a;
  user-select: none;
}

.jump-arrow {
  background: transparent;
  border: none;
  border-right: 1px solid #2a2a2a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.45rem;
  transition: background 0.15s;
}
.jump-arrow:last-child { border-right: none; }

.chevron {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-right: 1.5px solid currentColor;
  border-top: 1.5px solid currentColor;
}
.chevron--up  { transform: translateY(1px) rotate(-45deg); }
.chevron--down { transform: translateY(-1px) rotate(135deg); }

.jump-btn {
  background: transparent;
  border: 1px solid #2a2a2a;
  border-radius: 5px;
  color: #555;
  cursor: pointer;
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
  transition: border-color 0.15s, color 0.15s;
  white-space: nowrap;
}
.jump-btn:hover { border-color: #444; color: #aaa; }

.log-warn .log-text { color: #e5a60a; }

:deep(.log-highlight) {
  background: rgba(255, 214, 0, 0.3);
  color: #ffd600;
  border-radius: 2px;
  padding: 0 1px;
}

.logs-terminal {
  background: #030303;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.8125rem;
  line-height: 1.6;
  max-height: 600px;
  overflow-y: auto;
  padding: 0.75rem 1rem;
}

.logs-empty {
  color: #333;
  padding: 2rem;
  text-align: center;
  font-family: inherit;
}

.log-line { display: flex; }
.log-text { white-space: pre-wrap; word-break: break-all; }

.log-stdout .log-text { color: #aaa; }
.log-stderr .log-text { color: #e5484d; }
.log-command .log-text { color: #4d9ff0; }
.log-command .log-text::before { content: '$ '; color: #555; }

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

.state-ready    { background: rgba(0, 201, 80, 0.12);  color: #00c950; }
.state-error    { background: rgba(229, 72, 77, 0.12); color: #e5484d; }
.state-building { background: rgba(255, 153, 10, 0.12); color: #ff990a; }
.state-canceled { background: rgba(136, 136, 136, 0.12); color: #777; }
.state-queued   { background: rgba(0, 112, 243, 0.12); color: #4d9ff0; }
.state-unknown  { background: rgba(100, 100, 100, 0.1); color: #555; }

.prod-tag {
  background: rgba(0, 112, 243, 0.1);
  border: 1px solid rgba(0, 112, 243, 0.2);
  border-radius: 3px;
  color: #4d9ff0;
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  padding: 0.1rem 0.375rem;
}

/* Empty / loading */
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

.error-state { color: #e5484d; }
.error-icon { font-size: 1.5rem; }

.spinner {
  animation: spin 0.7s linear infinite;
  border: 2px solid #222;
  border-top-color: #555;
  border-radius: 50%;
  height: 24px;
  width: 24px;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Integration cards ───────────────────────────────────────────────────── */
.integration-card {
  background: #080808;
  border: 1px solid #1a1a1a;
  border-radius: 8px;
  margin-bottom: 1rem;
  padding: 0.875rem 1rem;
  transition: border-color 0.15s;
}

.card-clickable {
  cursor: pointer;
}
.card-clickable:hover {
  border-color: #2a2a2a;
}

.card-header {
  align-items: center;
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.card-brand-icon {
  color: #555;
  flex-shrink: 0;
  height: 14px;
  width: 14px;
}

.card-label {
  color: #444;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  flex: 1;
}

.card-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid #2a2a2a;
  border-top-color: #555;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.card-ext-link {
  color: #333;
  font-size: 0.75rem;
}

.card-loading { color: #333; font-size: 0.8125rem; }
.card-error   { color: #e5484d; font-size: 0.8125rem; }
.card-muted   { color: #555; }

/* Label : Value rows */
.info-row {
  align-items: center;
  display: flex;
  gap: 0.75rem;
  min-height: 1.6rem;
}

.info-row + .info-row {
  border-top: 1px solid #111;
  margin-top: 0.375rem;
  padding-top: 0.375rem;
}

.info-label {
  color: #444;
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  width: 64px;
}

.info-value {
  color: #ccc;
  font-size: 0.8125rem;
  line-height: 1.4;
}

.info-chips {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

/* PR state badge */
.pr-state-badge {
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.15rem 0.45rem;
  text-transform: uppercase;
  white-space: nowrap;
}
.pr-open   { background: rgba(0, 201, 80, 0.1);    color: #00c950; }
.pr-merged { background: rgba(110, 84, 148, 0.12); color: #a78bce; }
.pr-closed { background: rgba(229, 72, 77, 0.1);   color: #e5484d; }

/* Review */
.review-ok    { color: #00c950; font-size: 0.8125rem; }
.review-block { color: #e5484d; font-size: 0.8125rem; }

/* GitHub labels */
.gh-label {
  border: 1px solid;
  border-radius: 10px;
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.1rem 0.5rem;
}

/* Jira status badge */
.jira-status-badge {
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.15rem 0.45rem;
  text-transform: uppercase;
  white-space: nowrap;
}
.jira-done       { background: rgba(0, 201, 80, 0.1);   color: #00c950; }
.jira-inprogress { background: rgba(255, 153, 10, 0.1); color: #ff990a; }
.jira-todo       { background: rgba(77, 159, 240, 0.1); color: #4d9ff0; }

.jira-key-inline {
  color: #4d9ff0;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.75rem;
  margin-right: 0.375rem;
}

/* Generic meta pills */
.meta-pill {
  background: #111;
  border: 1px solid #222;
  border-radius: 4px;
  color: #555;
  font-size: 0.625rem;
  font-weight: 500;
  padding: 0.1rem 0.375rem;
}

.assignee-avatar {
  border-radius: 50%;
  flex-shrink: 0;
  height: 16px;
  width: 16px;
}
</style>
