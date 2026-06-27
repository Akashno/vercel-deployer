<script setup lang="ts">
defineProps<{
  projectName?: string
  deploymentsCount?: number
  hasData: boolean
}>()

const emit = defineEmits<{
  (e: 'openSettings'): void
}>()

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

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  navigateTo('/login')
}

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
})
</script>

<template>
  <header class="flex items-center justify-between flex-wrap gap-4 mb-4">
    <div class="flex items-center gap-2.5">
      <div class="flex items-center gap-2">
        <!-- Project Logo / Avatar -->
        <div
          class="w-6 h-6 rounded-md bg-gradient-to-br from-blue-main to-purple-600 flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-wider shrink-0"
        >
          {{ projectName ? projectName.slice(0, 2) : 'VP' }}
        </div>
        <span class="text-[18px] font-semibold tracking-[-0.02em] text-text-primary">{{ projectName ?? '—' }}</span>
      </div>
      <span v-if="hasData && deploymentsCount !== undefined" class="bg-border-secondary border border-border-primary rounded-full text-text-secondary text-xs font-medium px-2 py-[1px]">
        {{ deploymentsCount }}
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

      <!-- Settings Icon -->
      <button
        class="inline-flex items-center bg-card border border-border-primary rounded-[6px] text-text-secondary cursor-pointer text-sm p-2 transition-colors hover:text-text-primary hover:bg-btn"
        @click="emit('openSettings')"
        title="Settings"
      >
        <Icon name="lucide:settings" class="h-4 w-4" />
      </button>

      <button
        class="inline-flex items-center bg-card border border-border-primary rounded-[6px] text-text-tertiary cursor-pointer text-sm gap-1.5 px-3 py-[6.4px] transition-colors hover:bg-red-bg hover:border-red-border hover:text-red-text"
        @click="logout"
      >
        Logout
      </button>
    </div>
  </header>
</template>
