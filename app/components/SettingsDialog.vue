<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const settingsTab = ref<'general' | 'team'>('general')

// User identity check
const { data: userMe } = await useFetch<{ email: string; isAdmin: boolean }>('/api/auth/me')
const isSuperAdminUser = computed(() => userMe.value?.isAdmin ?? false)

// Team management state
const teamUsers = ref<{ email: string; password: string }[]>([])
const teamLoading = ref(false)

// Builder state — members staged before generating the env string
const pendingEmail = ref('')
const pendingPassword = ref('')
const pendingMembers = ref<{ email: string; password: string }[]>([])
const envCopied = ref(false)
const showPasswords = ref(false)
const copiedPasswordEmail = ref<string | null>(null)

function generatePassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#'
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function fillPassword() {
  pendingPassword.value = generatePassword()
}

function addPending() {
  const email = pendingEmail.value.trim().toLowerCase()
  const pass = pendingPassword.value.trim()
  if (!email || !pass || !email.includes('@')) return
  // Avoid duplicate emails
  if (pendingMembers.value.some(m => m.email === email)) return
  if (teamUsers.value.some(u => u.email === email)) return
  pendingMembers.value.push({ email, password: pass })
  pendingEmail.value = ''
  pendingPassword.value = ''
}

function removeStagedMember(email: string) {
  pendingMembers.value = pendingMembers.value.filter(m => m.email !== email)
}

function removeExistingMember(email: string) {
  teamUsers.value = teamUsers.value.filter(u => u.email !== email)
}

function copyPassword(email: string, password: string) {
  const origin = window.location.origin
  const text = `Login URL: ${origin}/login\nEmail: ${email}\nPassword: ${password}`
  navigator.clipboard.writeText(text).then(() => {
    copiedPasswordEmail.value = email
    setTimeout(() => { copiedPasswordEmail.value = null }, 2000)
  })
}

// Generated env string: all existing + all staged
const allMembers = computed(() => [
  ...teamUsers.value,
  ...pendingMembers.value,
])

const generatedEnvValue = computed(() => {
  if (!allMembers.value.length) return 'TEAM_MEMBERS='
  const parts = allMembers.value.map(m => `${m.email}:${m.password}`)
  return `TEAM_MEMBERS="${parts.join(',')}"`
})

function copyEnvString() {
  navigator.clipboard.writeText(generatedEnvValue.value).then(() => {
    envCopied.value = true
    setTimeout(() => { envCopied.value = false }, 2500)
  })
}

async function fetchTeamUsers() {
  if (!isSuperAdminUser.value) return
  teamLoading.value = true
  try {
    teamUsers.value = await $fetch<{ email: string; password: string }[]>('/api/admin/users')
  } catch (err) {
    console.error('Failed to fetch team users:', err)
  } finally {
    teamLoading.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}

// Watch settings modal opening to load users
watch(
  () => props.modelValue,
  (val) => {
    if (val && settingsTab.value === 'team') {
      fetchTeamUsers()
    }
  }
)

watch(settingsTab, (tab) => {
  if (tab === 'team') {
    fetchTeamUsers()
  }
})

// Close on Escape
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.modelValue) {
    close()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="close"
      >
        <div class="bg-card border border-border-primary rounded-[12px] w-[780px] h-[560px] max-w-[95vw] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
          <!-- Modal Header -->
          <div class="px-5 py-4 border-b border-border-primary flex items-center justify-between">
            <span class="text-sm font-semibold text-text-primary">Dashboard Settings</span>
            <button @click="close" class="text-text-tertiary hover:text-text-primary text-sm">✕</button>
          </div>

          <!-- Modal Body -->
          <div class="flex flex-1 overflow-hidden">
            <!-- Sidebar tabs -->
            <div class="w-1/3 border-r border-border-primary bg-zinc-950/20 p-2.5 flex flex-col gap-1">
              <button
                class="w-full text-left px-3 py-2 rounded-[6px] text-xs font-medium transition-colors"
                :class="settingsTab === 'general' ? 'bg-btn text-text-primary' : 'text-text-secondary hover:bg-btn/50 hover:text-text-primary'"
                @click="settingsTab = 'general'"
              >
                General Settings
              </button>
              <button
                v-if="isSuperAdminUser"
                class="w-full text-left px-3 py-2 rounded-[6px] text-xs font-medium transition-colors"
                :class="settingsTab === 'team' ? 'bg-btn text-text-primary' : 'text-text-secondary hover:bg-btn/50 hover:text-text-primary'"
                @click="settingsTab = 'team'"
              >
                Team Management
              </button>
            </div>

            <!-- Tab Content -->
            <div class="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
              <!-- General Settings Tab -->
              <div v-if="settingsTab === 'general'" class="text-xs text-text-secondary leading-relaxed flex flex-col gap-4">
                <div>
                  <p class="font-medium text-text-primary mb-1.5">User Profile</p>
                  <div class="bg-zinc-50 dark:bg-zinc-950/30 border border-border-secondary rounded-[6px] p-3 flex flex-col gap-1">
                    <span class="text-text-tertiary text-[10px] uppercase font-semibold tracking-wider">Logged In As</span>
                    <span class="font-mono text-text-primary font-medium select-all">{{ userMe?.email || '—' }}</span>
                    <span class="text-[10px] text-text-tertiary mt-1">Role: {{ isSuperAdminUser ? 'Administrator' : 'Team Member' }}</span>
                  </div>
                </div>
                <div>
                  <p class="font-medium text-text-primary mb-1">General Configurations</p>
                  <p class="text-text-tertiary">General setup details and configuration keys are managed securely through server-side environment variables.</p>
                </div>
              </div>

              <!-- Team Management Tab -->
              <div v-if="settingsTab === 'team' && isSuperAdminUser" class="flex flex-col gap-5">

                <!-- ── Step 1: Add members ─────────────────────── -->
                <div class="flex flex-col gap-2.5">
                  <div class="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                    <span class="w-4 h-4 rounded-full bg-blue-main text-white text-[9px] flex items-center justify-center shrink-0 font-bold">1</span>
                    Add Team Members
                  </div>
                  <div class="flex gap-2">
                    <input
                      v-model="pendingEmail"
                      type="email"
                      placeholder="email@company.com"
                      @keyup.enter="addPending"
                      class="flex-1 min-w-0 bg-input border border-border-primary focus:border-border-focus rounded-[6px] text-xs outline-none px-3 py-2 text-text-primary placeholder-text-quaternary"
                    />
                    <div class="flex items-center border border-border-primary rounded-[6px] bg-input overflow-hidden focus-within:border-border-focus">
                      <input
                        v-model="pendingPassword"
                        :type="showPasswords ? 'text' : 'password'"
                        placeholder="Password"
                        @keyup.enter="addPending"
                        class="bg-transparent text-xs outline-none px-3 py-2 text-text-primary placeholder-text-quaternary w-[130px]"
                      />
                      <button type="button" @click="fillPassword" title="Generate password" class="px-2 py-2 text-text-tertiary hover:text-blue-text transition-colors border-l border-border-primary">
                        <Icon name="lucide:refresh-cw" class="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      @click="addPending"
                      :disabled="!pendingEmail || !pendingPassword"
                      class="bg-blue-main hover:bg-blue-main-hover text-white text-xs px-3.5 py-2 rounded-[6px] font-semibold transition-colors disabled:opacity-40 shrink-0"
                    >
                      Add
                    </button>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <button type="button" @click="showPasswords = !showPasswords" class="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors flex items-center gap-1">
                      <Icon :name="showPasswords ? 'lucide:eye-off' : 'lucide:eye'" class="h-3 w-3" />
                      {{ showPasswords ? 'Hide passwords' : 'Show passwords' }}
                    </button>
                    <span class="text-[10px] text-text-quaternary">·</span>
                    <span class="text-[10px] text-text-quaternary">Press <kbd class="font-mono bg-zinc-950/30 px-1 rounded">↵</kbd> to add</span>
                  </div>
                </div>

                <!-- ── Step 2: Staged list ─────────────────────── -->
                <div class="flex flex-col gap-2">
                  <div class="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                    <span class="w-4 h-4 rounded-full bg-blue-main text-white text-[9px] flex items-center justify-center shrink-0 font-bold">2</span>
                    All Members
                    <span v-if="pendingMembers.length" class="ml-auto font-normal normal-case tracking-normal text-text-tertiary text-[10px]">{{ pendingMembers.length }} new queued</span>
                  </div>

                  <div class="text-xs text-text-tertiary py-2 text-center" v-if="teamLoading">Loading...</div>
                  <div v-else-if="teamUsers.length || pendingMembers.length" class="flex flex-col border border-border-primary rounded-[6px] divide-y divide-border-primary overflow-hidden">
                    <!-- existing -->
                    <div
                      v-for="user in teamUsers" :key="'ex-' + user.email"
                      class="flex items-center gap-2.5 px-3 py-2 text-xs bg-zinc-950/5"
                    >
                      <div class="w-5 h-5 rounded-full bg-gradient-to-br from-blue-main to-purple-600 flex items-center justify-center text-white text-[9px] font-bold uppercase shrink-0">{{ user.email.slice(0,1) }}</div>
                      <span class="text-text-primary truncate">{{ user.email }}</span>
                      <span class="font-mono text-[10px] text-text-tertiary shrink-0 ml-auto mr-1">{{ showPasswords ? user.password : '••••••••' }}</span>
                      <button @click="copyPassword(user.email, user.password)" class="text-text-tertiary hover:text-blue-text rounded p-0.5 transition-colors shrink-0 mr-1" :title="'Copy password'">
                        <Icon :name="copiedPasswordEmail === user.email ? 'lucide:check' : 'lucide:copy'" class="h-3 w-3" :class="copiedPasswordEmail === user.email ? 'text-green-400' : ''" />
                      </button>
                      <span class="text-[10px] text-text-tertiary bg-zinc-950/20 rounded px-1.5 py-0.5 shrink-0">active</span>
                      <button @click="removeExistingMember(user.email)" class="text-red-text hover:bg-red-bg rounded p-0.5 transition-colors shrink-0" title="Remove from env string">
                        <Icon name="lucide:x" class="h-3 w-3" />
                      </button>
                    </div>
                    <!-- pending -->
                    <div
                      v-for="m in pendingMembers" :key="'pd-' + m.email"
                      class="flex items-center gap-2.5 px-3 py-2 text-xs bg-blue-bg/30"
                    >
                      <div class="w-5 h-5 rounded-full bg-blue-main/40 border border-blue-border flex items-center justify-center text-blue-text text-[9px] font-bold uppercase shrink-0">{{ m.email.slice(0,1) }}</div>
                      <span class="text-text-primary truncate">{{ m.email }}</span>
                      <span class="font-mono text-[10px] text-text-tertiary shrink-0 ml-auto mr-1">{{ showPasswords ? m.password : '••••••••' }}</span>
                      <button @click="copyPassword(m.email, m.password)" class="text-text-tertiary hover:text-blue-text rounded p-0.5 transition-colors shrink-0 mr-1" :title="'Copy password'">
                        <Icon :name="copiedPasswordEmail === m.email ? 'lucide:check' : 'lucide:copy'" class="h-3 w-3" :class="copiedPasswordEmail === m.email ? 'text-green-400' : ''" />
                      </button>
                      <span class="text-[10px] text-blue-text bg-blue-bg rounded px-1.5 py-0.5 shrink-0 mr-1">new</span>
                      <button @click="removeStagedMember(m.email)" class="text-red-text hover:bg-red-bg rounded p-0.5 transition-colors shrink-0" title="Remove">
                        <Icon name="lucide:x" class="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div v-else class="text-xs text-text-tertiary py-3 text-center italic border border-border-primary rounded-[6px]">
                    No members yet — add them above.
                  </div>
                </div>

                <!-- ── Step 3: Generated env string ───────────── -->
                <div class="flex flex-col gap-2">
                  <div class="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                    <span class="w-4 h-4 rounded-full bg-blue-main text-white flex items-center justify-center shrink-0 font-bold text-[9px]">3</span>
                    Copy & Add to Your Env
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-[10px] text-text-tertiary font-mono truncate">
                        {{ allMembers.length ? `TEAM_MEMBERS="…${allMembers.length} member${allMembers.length !== 1 ? 's' : ''}"` : 'TEAM_MEMBERS=' }}
                      </span>
                      <button
                        @click="copyEnvString"
                        class="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-[6px] transition-colors shrink-0"
                        :class="envCopied ? 'text-green-400 bg-green-950/40' : 'text-blue-text bg-blue-bg hover:bg-blue-border'"
                      >
                        <Icon :name="envCopied ? 'lucide:check' : 'lucide:copy'" class="h-3 w-3" />
                        {{ envCopied ? 'Copied!' : 'Copy' }}
                      </button>
                    </div>
                    <div class="font-mono text-[10px] text-text-secondary bg-zinc-50 dark:bg-zinc-950/40 border border-border-secondary rounded-[6px] p-3 overflow-x-auto select-all whitespace-nowrap">
                      {{ generatedEnvValue }}
                    </div>
                  </div>
                  <p class="text-[10px] text-text-tertiary">
                    Add this to your <span class="font-mono">.env</span> file (or your hosting platform's environment variable settings) and redeploy.
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
