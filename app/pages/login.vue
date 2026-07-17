<script setup lang="ts">
definePageMeta({ layout: false })

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const passwordType = ref<'text' | 'password'>('password')
const passwordInput = useTemplateRef<HTMLInputElement>('password-input')
async function togglePasswordType() {
  passwordType.value = (
    passwordType.value === 'password'
      ? 'text'
      : 'password'
  )

  await nextTick()

  const passwordLength = password.value.length
  passwordInput.value?.focus()
  passwordInput.value?.setSelectionRange(passwordLength, passwordLength)
}
const passwordInputIcon = computed(() => {
  return (
    passwordType.value === 'password'
      ? 'lucide:eye'
      : 'lucide:eye-off'
  )
})

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        username: username.value,
        password: password.value,
      },
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
    <div class="relative w-full max-w-sm dark:bg-gradient-to-br from-sky-400/40 via-page to-fuchsia-400/40 p-px rounded-2xl">
      <!-- Glow effects -->
      <div class="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 size-7/12 portrait:size-1/3 bg-sky-400/30 rounded-full blur-3xl" />
      <div class="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 size-7/12 portrait:size-1/3 bg-fuchsia-400/30 rounded-full blur-3xl" />

      <div class="bg-card rounded-2xl shadow-lg p-8 transform transition-all hover:border-border-focus/60 duration-300">
        <div class="flex flex-col mb-8">
          <h1 class="text-2xl font-bold text-text-primary tracking-tight">
            Vercel Deployer
          </h1>
          <p class="mt-2 text-sm text-text-tertiary">
            Sign in to continue to your dashboard
          </p>
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
            <div class="relative w-full">
              <input
                id="password"
                v-model="password"
                :type="passwordType"
                autocomplete="current-password"
                placeholder="••••••••"
                ref="password-input"
                :disabled="loading"
                required
                class="w-full bg-input border border-border-primary hover:border-border-focus focus:border-border-focus focus:ring-1 focus:ring-border-focus outline-none rounded-lg px-3 py-2 text-text-primary placeholder-text-quaternary text-sm transition-all disabled:opacity-50"
              />
              <button
                type="button"
                tabindex="-1"
                class="absolute top-px right-px grid place-content-center size-9 border border-transparent bg-btn hover:bg-btn-hover rounded-lg"
                @click="togglePasswordType">
                <Icon :name="passwordInputIcon" />
              </button>
            </div>
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
            <span>
              {{ loading ? 'Signing In…' : 'Sign In' }}
            </span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
