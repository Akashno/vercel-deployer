<script setup lang="ts">
interface LogLine {
  type: string
  text: string
  date: number | null
}

const props = defineProps<{
  uid: string
  projectId: string
}>()

const isLogsOpen = ref(false)
const { data: logs, pending: logsPending, execute: fetchLogs } = useFetch<LogLine[]>(
  `/api/projects/${props.projectId}/deployments/${props.uid}/logs`,
  { immediate: false, server: false }
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

watch(filteredLogs, () => {
  errorCursor.value = 0
  warnCursor.value = 0
})

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
    if (logsTerminal.value) {
      logsTerminal.value.scrollTop = logsTerminal.value.scrollHeight
    }
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
  if (!pending && isLogsOpen.value) {
    scrollToBottom()
  }
})
</script>

<template>
  <div class="border border-border-secondary rounded-[8px] overflow-hidden mt-6">
    <!-- Header/Toggle Button -->
    <button
      @click="toggleLogs"
      class="w-full flex items-center justify-between px-4 py-3 bg-row-hover hover:bg-card-modal cursor-pointer transition-colors"
      :class="[ isLogsOpen ? 'border-b border-border-secondary' : '' ]"
    >
      <span class="text-text-tertiary text-[11px] font-medium tracking-[0.06em] uppercase">Build Logs</span>
      <div class="flex items-center gap-2.5 text-xs">
        <span v-if="logsPending" class="flex items-center gap-1.5 text-text-quaternary text-xs">
          <Icon name="lucide:loader-2" class="animate-spin h-3.5 w-3.5 text-zinc-500" />
          fetching…
        </span>
        <span v-else-if="logs" class="text-text-quaternary text-xs font-normal font-sans">{{ logs.length }} lines</span>
        
        <Icon
          name="lucide:chevron-right"
          class="text-text-quaternary text-[18px] transition-transform duration-200"
          :class="{ 'rotate-90': isLogsOpen }"
        />
      </div>
    </button>

    <!-- Toolbar -->
    <div
      v-if="isLogsOpen"
      class="flex items-center gap-2 px-3 py-1.5 bg-page border-b border-border-secondary"
    >
      <input
        v-model="logSearch"
        type="search"
        placeholder="Search logs…"
        class="bg-input border border-border-primary focus:border-border-focus rounded-[5px] text-text-primary text-xs px-2.5 py-[4.8px] w-[200px] outline-none placeholder-text-quaternary transition-colors"
      />
      
      <div class="flex items-center gap-1.5 text-[11px] ml-auto">
        <!-- Error Jumper -->
        <div v-if="errorIndices.length" class="flex items-center border border-border-primary rounded-[5px] overflow-hidden">
          <span class="text-red-text font-medium px-2 py-1 border-r border-border-primary select-none font-mono">
            {{ errorCursor + 1 }}/{{ errorIndices.length }} errors
          </span>
          <button
            @click="navigateError(-1)"
            title="Previous error"
            class="bg-transparent border-none text-red-text cursor-pointer flex items-center justify-center px-2 py-1 transition-colors hover:bg-red-bg border-r border-border-primary"
          >
            <Icon name="lucide:chevron-up" class="h-3.5 w-3.5" />
          </button>
          <button
            @click="navigateError(1)"
            title="Next error"
            class="bg-transparent border-none text-red-text cursor-pointer flex items-center justify-center px-2 py-1 transition-colors hover:bg-red-bg"
          >
            <Icon name="lucide:chevron-down" class="h-3.5 w-3.5" />
          </button>
        </div>

        <!-- Warning Jumper -->
        <div v-if="warnIndices.length" class="flex items-center border border-border-primary rounded-[5px] overflow-hidden">
          <span class="text-orange-text font-medium px-2 py-1 border-r border-border-primary select-none font-mono">
            {{ warnCursor + 1 }}/{{ warnIndices.length }} warnings
          </span>
          <button
            @click="navigateWarn(-1)"
            title="Previous warning"
            class="bg-transparent border-none text-orange-text cursor-pointer flex items-center justify-center px-2 py-1 transition-colors hover:bg-orange-bg border-r border-border-primary"
          >
            <Icon name="lucide:chevron-up" class="h-3.5 w-3.5" />
          </button>
          <button
            @click="navigateWarn(1)"
            title="Next warning"
            class="bg-transparent border-none text-orange-text cursor-pointer flex items-center justify-center px-2 py-1 transition-colors hover:bg-orange-bg"
          >
            <Icon name="lucide:chevron-down" class="h-3.5 w-3.5" />
          </button>
        </div>

        <!-- Bottom Button -->
        <button
          @click="scrollToBottom"
          class="bg-transparent border border-border-primary rounded-[5px] text-text-tertiary text-[11px] px-2 py-1 transition-colors hover:border-border-focus hover:text-text-secondary cursor-pointer"
        >
          Bottom
        </button>
      </div>
    </div>

    <!-- Terminal -->
    <div
      v-if="isLogsOpen"
      ref="logsTerminal"
      class="bg-page font-mono text-[13px] leading-[1.6] max-h-[600px] overflow-y-auto p-4 space-y-0.5"
    >
      <div v-if="logsPending" class="text-text-quaternary py-8 text-center">Loading logs…</div>
      <div v-else-if="!filteredLogs.length" class="text-text-quaternary py-8 text-center">
        {{ logSearch ? 'No lines match your search.' : 'No build logs available.' }}
      </div>
      <template v-else>
        <div
          v-for="(line, i) in filteredLogs"
          :key="i"
          class="log-line flex"
        >
          <span
            class="log-text whitespace-pre-wrap break-all flex-1"
            :class="{
              'text-text-secondary': line.type === 'stdout',
              'text-red-text': line.type === 'stderr',
              'text-blue-text': line.type === 'command',
              'text-orange-text': line.type !== 'stderr' && line.text.toLowerCase().includes('warn')
            }"
          >
            <span v-if="line.type === 'command'" class="text-text-tertiary select-none font-semibold">$ </span>
            <span v-html="highlight(line.text)" />
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
:deep(.log-highlight) {
  background: rgba(255, 214, 0, 0.3);
  color: #ffd600;
  border-radius: 2px;
  padding: 0 1px;
}
</style>
