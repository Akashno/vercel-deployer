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

const route = useRoute()
const uid = route.params.uid as string

const { data, pending, error } = await useFetch<DeploymentDetail>(`/api/deployments/${uid}`)

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
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
})

function formatTs(ts: number | null): string {
  return ts ? dtf.format(new Date(ts)) : '—'
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
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
      <div class="detail-header">
        <div class="detail-title-row">
          <span :class="['badge', getBadgeClass(data.state)]">{{ data.state }}</span>
          <h1 class="detail-title">{{ data.name }}</h1>
          <span v-if="data.target === 'production'" class="prod-tag">Production</span>
        </div>
        <div class="detail-actions">
          <a :href="`https://${data.url}`" target="_blank" rel="noopener" class="action-btn primary">
            Visit ↗
          </a>
          <a v-if="data.inspectorUrl" :href="data.inspectorUrl" target="_blank" rel="noopener" class="action-btn">
            Vercel Dashboard ↗
          </a>
        </div>
      </div>

      <div class="cards">
        <div class="card">
          <div class="card-title">Deployment URL</div>
          <a :href="`https://${data.url}`" target="_blank" rel="noopener" class="mono-link">
            {{ data.url }}
          </a>
        </div>

        <div class="card">
          <div class="card-title">Git</div>
          <div v-if="data.branch" class="meta-row">
            <span class="meta-label">Branch</span>
            <a v-if="data.repoUrl" :href="`${data.repoUrl}/tree/${data.branch}`" target="_blank" rel="noopener" class="mono-link">{{ data.branch }}</a>
            <code v-else class="mono">{{ data.branch }}</code>
          </div>
          <div v-if="data.commitSha" class="meta-row">
            <span class="meta-label">Commit</span>
            <a v-if="data.repoUrl" :href="`${data.repoUrl}/commit/${data.commitSha}`" target="_blank" rel="noopener" class="mono-link sha">{{ data.commitSha.slice(0, 7) }}</a>
            <code v-else class="sha mono">{{ data.commitSha.slice(0, 7) }}</code>
          </div>
          <div v-if="data.commitMessage" class="meta-row">
            <span class="meta-label">Message</span>
            <span class="commit-msg">{{ data.commitMessage }}</span>
          </div>
          <div v-if="data.commitAuthor" class="meta-row">
            <span class="meta-label">Author</span>
            <span class="meta-value">{{ data.commitAuthor }}</span>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Timeline</div>
          <div class="meta-row">
            <span class="meta-label">Created</span>
            <span class="meta-value">{{ formatTs(data.createdAt) }}</span>
          </div>
          <div v-if="data.buildingAt" class="meta-row">
            <span class="meta-label">Build started</span>
            <span class="meta-value">{{ formatTs(data.buildingAt) }}</span>
          </div>
          <div v-if="data.readyAt" class="meta-row">
            <span class="meta-label">Ready at</span>
            <span class="meta-value">{{ formatTs(data.readyAt) }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Build duration</span>
            <span class="meta-value">{{ formatDuration(data.buildDurationMs) }}</span>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Info</div>
          <div v-if="data.creator" class="meta-row">
            <span class="meta-label">Deployed by</span>
            <span class="meta-value">{{ data.creator }}</span>
          </div>
          <div v-if="data.regions.length" class="meta-row">
            <span class="meta-label">Regions</span>
            <span class="meta-value mono">{{ data.regions.join(', ') }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">UID</span>
            <code class="mono uid-code">{{ data.uid }}</code>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.breadcrumb {
  margin-bottom: 1.5rem;
}

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
  margin-bottom: 2rem;
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

/* Cards */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 1rem;
}

.card {
  background: #080808;
  border: 1px solid #1a1a1a;
  border-radius: 8px;
  padding: 1.25rem;
}

.card-title {
  color: #555;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  margin-bottom: 1rem;
  text-transform: uppercase;
}

.meta-row {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid #111;
}

.meta-row:last-child { border-bottom: none; }

.meta-label {
  color: #555;
  font-size: 0.8125rem;
  flex-shrink: 0;
  width: 110px;
}

.meta-value {
  color: #ccc;
  font-size: 0.8125rem;
  word-break: break-all;
}

.mono { font-family: 'Menlo', 'Consolas', monospace; }

.mono-link {
  color: #ccc;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.8125rem;
  text-decoration: none;
  word-break: break-all;
}

.mono-link:hover { color: #fff; text-decoration: underline; }

.sha {
  background: #111;
  border: 1px solid #222;
  border-radius: 3px;
  color: #666;
  font-size: 0.75rem;
  padding: 0.05rem 0.35rem;
}

.commit-msg {
  color: #888;
  font-size: 0.8125rem;
  word-break: break-word;
}

.uid-code {
  color: #444;
  font-size: 0.75rem;
  word-break: break-all;
}

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

.prod-tag {
  background: rgba(0, 112, 243, 0.1);
  border: 1px solid rgba(0, 112, 243, 0.2);
  border-radius: 3px;
  color: #4d9ff0;
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  padding: 0.1rem 0.375rem;
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
