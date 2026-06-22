<script setup lang="ts">
interface Deployment {
  state: string
  url: string
  target: string | null
  createdAt: number | null
  inspectorUrl: string | null
  branch: string | null
  commitSha: string | null
  commitMessage: string | null
  commitAuthor: string | null
}

const search = ref('')
const autoRefresh = ref(false)

const { data, pending, error, refresh } = await useFetch<Deployment[]>('/api/deployments')

const filteredDeployments = computed(() => {
  if (!data.value) return []
  const q = search.value.toLowerCase().trim()
  if (!q) return data.value
  return data.value.filter(d =>
    (d.branch ?? '').toLowerCase().includes(q) ||
    (d.url ?? '').toLowerCase().includes(q) ||
    (d.commitMessage ?? '').toLowerCase().includes(q) ||
    (d.commitAuthor ?? '').toLowerCase().includes(q),
  )
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
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
})
</script>

<template>
  <div class="page">
    <header class="header">
      <div class="header-left">
        <h1 class="title">Deployments</h1>
        <span v-if="data" class="count">{{ filteredDeployments.length }}</span>
      </div>
      <div class="controls">
        <input
          v-model="search"
          class="search"
          type="search"
          placeholder="Search branch, URL, commit, author…"
          aria-label="Search deployments"
        />
        <button class="btn" :disabled="pending" @click="refresh">
          <span :class="{ spinning: pending }">↻</span>
          Refresh
        </button>
        <label class="auto-label">
          <input v-model="autoRefresh" type="checkbox" class="auto-checkbox" />
          Auto (30s)
        </label>
      </div>
    </header>

    <div v-if="pending && !data" class="empty-state">
      <div class="spinner" />
      <span>Loading deployments…</span>
    </div>

    <div v-else-if="error" class="empty-state error-state">
      <span class="error-icon">⚠</span>
      <span>{{ error.message }}</span>
    </div>

    <div v-else-if="!filteredDeployments.length" class="empty-state">
      <span>No deployments found{{ search ? ' for your search' : '' }}.</span>
    </div>

    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Status</th>
            <th>URL</th>
            <th>Branch / Commit</th>
            <th>Created At</th>
            <th>Commit Author</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in filteredDeployments" :key="d.url + d.createdAt">
            <td>
              <span :class="['badge', getBadgeClass(d.state)]">{{ d.state }}</span>
            </td>
            <td>
              <div class="url-cell">
                <a
                  :href="`https://${d.url}`"
                  target="_blank"
                  rel="noopener"
                  class="url-link"
                >{{ d.url }}</a>
                <a
                  v-if="d.inspectorUrl"
                  :href="d.inspectorUrl"
                  target="_blank"
                  rel="noopener"
                  class="inspector-link"
                  title="Open in Vercel dashboard"
                >↗</a>
              </div>
              <span v-if="d.target === 'production'" class="prod-tag">Production</span>
            </td>
            <td>
              <div v-if="d.branch" class="branch">{{ d.branch }}</div>
              <div v-if="d.commitSha" class="commit-line">
                <code class="sha">{{ d.commitSha }}</code>
                <span class="commit-msg">{{ d.commitMessage }}</span>
              </div>
            </td>
            <td class="created-at">{{ formatCreatedAt(d.createdAt) }}</td>
            <td class="author">{{ d.commitAuthor || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
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
  margin-bottom: 1.5rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.title {
  font-size: 1.375rem;
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
  font-size: 0.875rem;
  outline: none;
  padding: 0.4rem 0.75rem;
  transition: border-color 0.15s;
  width: 280px;
}

.search:focus { border-color: #555; }
.search::placeholder { color: #555; }

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

.btn:hover:not(:disabled) { background: #111; border-color: #444; }
.btn:disabled { opacity: 0.5; cursor: default; }

.spinning { display: inline-block; animation: spin 0.8s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

.auto-label {
  align-items: center;
  color: #666;
  cursor: pointer;
  display: flex;
  font-size: 0.8125rem;
  gap: 0.375rem;
  user-select: none;
}

.auto-checkbox { accent-color: #0070f3; cursor: pointer; }

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
  vertical-align: top;
}

.table tbody tr:last-child td { border-bottom: none; }

.table tbody tr:hover td { background: #080808; }

/* Status badge */
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

/* URL cell */
.url-cell {
  align-items: center;
  display: flex;
  gap: 0.375rem;
}

.url-link {
  color: #ccc;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.8125rem;
  overflow: hidden;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.url-link:hover { color: #fff; text-decoration: underline; }

.inspector-link {
  color: #444;
  flex-shrink: 0;
  font-size: 0.75rem;
  text-decoration: none;
}

.inspector-link:hover { color: #888; }

.prod-tag {
  background: rgba(0, 112, 243, 0.1);
  border: 1px solid rgba(0, 112, 243, 0.2);
  border-radius: 3px;
  color: #4d9ff0;
  display: inline-block;
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  margin-top: 0.3rem;
  padding: 0.1rem 0.375rem;
}

/* Branch / commit */
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
  font-size: 0.75rem;
  font-family: 'Menlo', 'Consolas', monospace;
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

/* Misc cells */
.created-at {
  color: #666;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.author {
  color: #888;
  font-size: 0.8125rem;
}
</style>
