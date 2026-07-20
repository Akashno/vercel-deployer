<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  branch: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
}>()

function close() {
  emit('update:modelValue', false)
}

function confirm() {
  emit('confirm')
  close()
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
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
        @click.self="close"
      >
        <div
          class="w-[calc(100%-2rem)] max-w-95 bg-card-modal border border-border-tertiary rounded-[10px] p-6 pt-7 shadow-2xl transform transition-all text-center"
          role="dialog"
          aria-modal="true"
        >
          <!-- Icon -->
          <div class="flex justify-center mb-4">
            <Icon name="lucide:layers" class="text-text-quaternary h-7 w-7" />
          </div>

          <!-- Content -->
          <p class="text-[15px] font-semibold text-text-primary mb-2.5">Deploy</p>
          <p class="text-[13px] text-text-tertiary leading-[1.6] mb-6">
            This will push an empty commit to
            <code class="bg-btn border border-border-primary rounded-[3px] text-text-secondary font-mono text-xs px-1.5 py-[0.8px]">{{ branch }}</code>
            on GitHub, triggering a new Vercel deployment.
          </p>

          <!-- Actions -->
          <div class="flex gap-2 justify-end">
            <button
              type="button"
              @click="close"
              class="bg-transparent border border-border-primary rounded-md text-text-tertiary text-sm px-3.5 py-[6.4px] transition-colors hover:border-border-focus hover:text-text-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="confirm"
              class="bg-btn border border-border-primary/80 rounded-md text-text-secondary text-sm px-3.5 py-[6.4px] transition-colors hover:bg-btn-hover hover:border-border-focus hover:text-text-primary cursor-pointer"
            >
              Deploy
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
