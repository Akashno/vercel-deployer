<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    state: string
    pulse?: boolean
  }>(),
  {
    pulse: false,
  }
)

const normalizedState = computed(() => props.state?.toUpperCase() ?? 'UNKNOWN')

const isPulseActive = computed(() => {
  if (props.pulse) return true
  return ['BUILDING', 'QUEUED', 'INITIALIZING'].includes(normalizedState.value)
})

const badgeConfig = computed(() => {
  switch (normalizedState.value) {
    case 'READY':
      return {
        bg: 'bg-green-bg',
        text: 'text-green-text',
        label: 'Ready',
      }
    case 'ERROR':
      return {
        bg: 'bg-red-bg',
        text: 'text-red-text',
        label: 'Error',
      }
    case 'BUILDING':
      return {
        bg: 'bg-orange-bg',
        text: 'text-orange-text',
        label: 'Building',
      }
    case 'CANCELED':
      return {
        bg: 'bg-text-tertiary/10',
        text: 'text-text-tertiary',
        label: 'Canceled',
      }
    case 'QUEUED':
      return {
        bg: 'bg-blue-bg',
        text: 'text-blue-text',
        label: 'Queued',
      }
    case 'INITIALIZING':
      return {
        bg: 'bg-blue-bg',
        text: 'text-blue-text',
        label: 'Initializing',
      }
    default:
      return {
        bg: 'bg-text-quaternary/10',
        text: 'text-text-quaternary',
        label: props.state || 'Unknown',
      }
  }
})
</script>

<template>
  <span
    class="inline-block px-2 py-[3.2px] rounded-sm text-[11px] font-semibold tracking-[0.07em] uppercase whitespace-nowrap transition-all duration-300"
    :class="[
      badgeConfig.bg,
      badgeConfig.text,
      { 'badge--pulse': isPulseActive }
    ]"
  >
    {{ badgeConfig.label }}
  </span>
</template>

<style scoped>
.badge--pulse {
  animation: badge-pulse 1.8s ease-in-out infinite;
}

@keyframes badge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
</style>
