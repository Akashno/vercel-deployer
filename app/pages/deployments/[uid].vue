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

async function toggleLogs() {
  isLogsOpen.value = !isLogsOpen.value
  if (isLogsOpen.value && !logs.value) {
    await fetchLogs()
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
        <div v-if="isLogsOpen" class="logs-terminal">
          <div v-if="logsPending" class="logs-empty">Loading logs…</div>
          <div v-else-if="!logs?.length" class="logs-empty">No build logs available.</div>
          <template v-else>
            <div
              v-for="(line, i) in logs"
              :key="i"
              :class="['log-line', `log-${line.type}`]"
            >
              <span class="log-text">{{ line.text }}</span>
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
