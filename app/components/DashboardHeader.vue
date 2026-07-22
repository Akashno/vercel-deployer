<script setup lang="ts">
defineProps<{
  projectName?: string
  deploymentsCount?: number
  hasData: boolean
  projects?: { id: string; name: string }[]
  currentProjectId?: string | null
}>()

const emit = defineEmits<{
  (e: 'openSettings'): void
  (e: 'update:currentProjectId', id: string): void
}>()

const isDark = ref(true)
const switcherOpen = ref(false)
const switcherEl = ref<HTMLElement | null>(null)

function selectProject(id: string) {
  emit('update:currentProjectId', id)
  switcherOpen.value = false
}

function onClickOutside(e: MouseEvent) {
  if (switcherOpen.value && switcherEl.value && !switcherEl.value.contains(e.target as Node)) {
    switcherOpen.value = false
  }
}

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

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  navigateTo('/login')
}

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') switcherOpen.value = false
  }
  window.addEventListener('click', onClickOutside)
  window.addEventListener('keydown', onKeydown)
  onUnmounted(() => {
    window.removeEventListener('click', onClickOutside)
    window.removeEventListener('keydown', onKeydown)
  })
})
</script>

<template>
  <header class="flex items-center justify-between flex-wrap gap-4 mb-4">
    <div class="flex items-center gap-2.5">
      <div class="flex items-center gap-2">
        <!-- Project Logo / Avatar -->
        <div
          class="w-6 h-6 rounded-md bg-linear-to-br from-blue-main to-purple-600 flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-wider shrink-0"
        >
          {{ projectName ? projectName.slice(0, 2) : 'VP' }}
        </div>

        <!-- Project Switcher (multiple projects) / static title (single project) -->
        <div v-if="projects && projects.length > 1" ref="switcherEl" class="relative">
          <button
            type="button"
            @click="switcherOpen = !switcherOpen"
            class="flex items-center gap-1 bg-transparent border-0 cursor-pointer text-lg font-semibold tracking-[-0.02em] text-text-primary outline-hidden"
          >
            {{ projects.find(p => p.id === currentProjectId)?.name ?? projectName ?? '—' }}
            <Icon name="lucide:chevron-down" class="h-3.5 w-3.5 text-text-tertiary" :class="{ 'rotate-180': switcherOpen }" />
          </button>

          <Transition name="fade">
            <div
              v-if="switcherOpen"
              class="absolute left-0 top-full mt-2.5 min-w-45 bg-card-modal border border-border-primary rounded-lg shadow-lg py-1 z-20"
            >
              <button
                v-for="p in projects"
                :key="p.id"
                type="button"
                @click="selectProject(p.id)"
                class="w-full flex items-center justify-between gap-3 bg-transparent border-0 cursor-pointer text-left text-[13px] px-3 py-1.75 transition-colors hover:bg-row-hover"
                :class="p.id === currentProjectId ? 'text-text-primary' : 'text-text-secondary'"
              >
                <span class="truncate">{{ p.name }}</span>
                <Icon v-if="p.id === currentProjectId" name="lucide:check" class="h-3.5 w-3.5 text-blue-text shrink-0" />
              </button>
            </div>
          </Transition>
        </div>
        <span v-else class="text-lg font-semibold tracking-[-0.02em] text-text-primary">{{ projectName ?? '—' }}</span>
      </div>
      <span v-if="hasData && deploymentsCount !== undefined" class="bg-border-secondary border border-border-primary rounded-full text-text-secondary text-xs font-medium px-2 py-px">
        {{ deploymentsCount }}
      </span>
    </div>
    <div class="flex items-center gap-2.5 flex-wrap">
      <!-- Theme Toggle -->
      <button
        class="inline-flex items-center bg-card border border-border-primary rounded-md text-text-secondary cursor-pointer text-sm p-2 transition-colors hover:text-text-primary hover:bg-btn"
        @click="toggleTheme"
        :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
      >
        <Icon :name="isDark ? 'lucide:sun' : 'lucide:moon'" class="h-4 w-4" />
      </button>

      <!-- Settings Icon -->
      <button
        class="inline-flex items-center bg-card border border-border-primary rounded-md text-text-secondary cursor-pointer text-sm p-2 transition-colors hover:text-text-primary hover:bg-btn"
        @click="emit('openSettings')"
        title="Settings"
      >
        <Icon name="lucide:settings" class="h-4 w-4" />
      </button>

      <button
        class="inline-flex items-center bg-card border border-border-primary rounded-md text-text-tertiary cursor-pointer text-sm gap-1.5 px-3 py-[6.4px] transition-colors hover:bg-red-bg hover:border-red-border hover:text-red-text"
        @click="logout"
      >
        Logout
      </button>
    </div>
  </header>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
