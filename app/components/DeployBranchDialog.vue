<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    initialBranch?: string
  }>(),
  {
    initialBranch: '',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'deploy', branch: string): void
}>()

const branch = ref(props.initialBranch)
const branchInput = ref<HTMLInputElement | null>(null)

watch(
  () => props.modelValue,
  async (newVal) => {
    if (newVal) {
      branch.value = props.initialBranch
      await nextTick()
      branchInput.value?.focus()
      if (branch.value) {
        branchInput.value?.select()
      }
    }
  }
)

function close() {
  emit('update:modelValue', false)
}

function submit() {
  const trimmed = branch.value.trim()
  if (trimmed) {
    emit('deploy', trimmed)
    close()
  }
}

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
        class="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 pt-[12vh] sm:pt-4 bg-black/60"
        @click.self="close"
      >
        <div
          class="w-[calc(100%-2rem)] max-w-[380px] max-h-[76vh] sm:max-h-[85vh] overflow-y-auto bg-card-modal border border-border-tertiary rounded-[10px] p-6 pt-7 shadow-2xl transform transition-all text-center"
          role="dialog"
          aria-modal="true"
        >
          <!-- Icon -->
          <div class="flex justify-center mb-4">
            <Icon name="lucide:rocket" class="text-text-quaternary h-7 w-7" />
          </div>

          <!-- Content -->
          <p class="text-[15px] font-semibold text-text-primary mb-2.5">Deploy a Branch</p>
          <p class="text-[13px] text-text-tertiary leading-[1.6] mb-6">
            Select a branch to trigger a new Vercel deployment via GitHub Actions.
          </p>

          <!-- Input & Actions -->
          <form @submit.prevent="submit">
            <input
              ref="branchInput"
              v-model="branch"
              type="text"
              placeholder="Branch name…"
              autocomplete="off"
              spellcheck="false"
              required
              class="bg-input border border-border-primary rounded-[6px] text-text-primary text-sm mb-6 outline-none px-3 py-2 transition-colors focus:border-border-focus placeholder-text-quaternary w-full"
            />

            <div class="flex gap-2 justify-end">
              <button
                type="button"
                @click="close"
                class="bg-transparent border border-border-primary rounded-[6px] text-text-tertiary text-sm px-3.5 py-[6.4px] transition-colors hover:border-border-focus hover:text-text-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="!branch.trim()"
                class="bg-blue-main border border-blue-main rounded-[6px] text-white text-sm px-3.5 py-[6.4px] transition-colors hover:not-disabled:bg-blue-main-hover hover:not-disabled:border-blue-main-hover disabled:opacity-40 disabled:cursor-default cursor-pointer font-normal"
              >
                Deploy
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
