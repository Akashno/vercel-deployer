<script setup lang="ts">
definePageMeta({ layout: false })

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    await navigateTo('/')
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message
    error.value = msg ?? 'Invalid credentials'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative flex items-center justify-center min-h-screen bg-page p-6 overflow-hidden">
    <!-- Ambient background glows -->
    <div class="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-blue-main/5 blur-[120px] pointer-events-none" />
    <div class="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

    <div class="w-full max-w-sm bg-card/60 backdrop-blur-xl border border-border-primary/80 rounded-2xl shadow-2xl p-8 transform transition-all hover:border-border-focus/60 duration-300">
      <!-- Glow effect top bar -->
      <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-main via-indigo-500 to-purple-500 opacity-60" />

      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-text-primary tracking-tight">Deployments</h1>
        <p class="mt-2 text-sm text-text-tertiary">Sign in to continue to your dashboard</p>
      </div>

      <form class="space-y-5" @submit.prevent="submit">
        <div class="space-y-1.5">
          <label class="block text-[11px] font-bold uppercase tracking-wider text-text-tertiary" for="username">Username</label>
          <input
            id="username"
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="username"
            :disabled="loading"
            required
            class="w-full bg-input border border-border-primary hover:border-border-focus focus:border-border-focus focus:ring-1 focus:ring-border-focus outline-none rounded-lg px-3 py-2 text-text-primary placeholder-text-quaternary text-sm transition-all disabled:opacity-50"
          />
        </div>

        <div class="space-y-1.5">
          <label class="block text-[11px] font-bold uppercase tracking-wider text-text-tertiary" for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            :disabled="loading"
            required
            class="w-full bg-input border border-border-primary hover:border-border-focus focus:border-border-focus focus:ring-1 focus:ring-border-focus outline-none rounded-lg px-3 py-2 text-text-primary placeholder-text-quaternary text-sm transition-all disabled:opacity-50"
          />
        </div>

        <div v-if="error" class="bg-red-bg/10 border border-red-border/20 text-red-text text-xs rounded-lg p-3 leading-relaxed">
          {{ error }}
        </div>

        <button
          class="w-full flex items-center justify-center px-4 py-2.5 bg-blue-main hover:bg-blue-main-hover disabled:opacity-60 disabled:hover:bg-blue-main text-sm font-semibold rounded-lg text-white transition-all duration-150 cursor-pointer shadow-lg shadow-blue-main/15 active:scale-[0.98]"
          type="submit"
          :disabled="loading"
        >
          <svg v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{{ loading ? 'Signing in…' : 'Sign in' }}</span>
        </button>
      </form>
    </div>
  </div>
</template>
