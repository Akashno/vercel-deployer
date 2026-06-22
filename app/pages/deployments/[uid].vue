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
  regions: string[]
  creator: string | null
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
</style>
