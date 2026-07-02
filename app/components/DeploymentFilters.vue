<script setup lang="ts">
const props = defineProps<{
  search: string
  filterStatus: string
  filterAuthor: string
  uniqueStatuses: string[]
  uniqueAuthors: string[]
  pending: boolean
  hasFilters: boolean
  hasData: boolean
}>()

const emit = defineEmits<{
  (e: 'update:search', value: string): void
  (e: 'update:filterStatus', value: string): void
  (e: 'update:filterAuthor', value: string): void
  (e: 'refresh'): void
  (e: 'deployBranch'): void
  (e: 'clearFilters'): void
}>()

const localSearch = computed({
  get: () => props.search,
  set: (val) => emit('update:search', val)
})

const localStatus = computed({
  get: () => props.filterStatus,
  set: (val) => emit('update:filterStatus', val)
})

const localAuthor = computed({
  get: () => props.filterAuthor,
  set: (val) => emit('update:filterAuthor', val)
})

const searchInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      searchInput.value?.focus()
    }
  }
  window.addEventListener('keydown', onKeydown)
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
  })
})
</script>

<template>
  <div v-if="hasData" class="flex justify-between items-center flex-wrap gap-3 mb-4">
    <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto">
      <!-- Search input -->
      <input
        ref="searchInput"
        v-model="localSearch"
        type="search"
        placeholder="Search branch, commit, author… (⌘K)"
        aria-label="Search deployments"
        class="bg-input border border-border-primary focus:border-border-focus rounded-[6px] text-text-primary text-[13px] outline-none px-3 py-[6.4px] transition-colors placeholder-text-quaternary w-full sm:w-[300px]"
      />

      <!-- Status select -->
      <div class="relative inline-block">
        <select
          v-model="localStatus"
          class="appearance-none bg-input border focus:border-border-focus hover:border-border-focus rounded-[6px] cursor-pointer text-[13px] outline-none pl-3 pr-8 py-[6.4px] transition-colors bg-[right_0.6rem_center] bg-no-repeat select-custom-arrow"
          :class="[ filterStatus ? 'border-blue-main text-text-primary' : 'border-border-primary text-text-secondary' ]"
        >
          <option value="">All statuses</option>
          <option v-for="s in uniqueStatuses" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <!-- Author select -->
      <div class="relative inline-block">
        <select
          v-model="localAuthor"
          class="appearance-none bg-input border focus:border-border-focus hover:border-border-focus rounded-[6px] cursor-pointer text-[13px] outline-none pl-3 pr-8 py-[6.4px] transition-colors bg-[right_0.6rem_center] bg-no-repeat select-custom-arrow"
          :class="[ filterAuthor ? 'border-blue-main text-text-primary' : 'border-border-primary text-text-secondary' ]"
        >
          <option value="">All authors</option>
          <option v-for="a in uniqueAuthors" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>

      <!-- Clear filters button -->
      <button
        v-if="hasFilters"
        @click="emit('clearFilters')"
        class="inline-flex items-center bg-card border border-red-border rounded-[6px] text-red-text cursor-pointer text-[13px] gap-1.5 px-3 py-[6.4px] transition-colors hover:bg-red-bg hover:border-red-main"
      >
        ✕ Clear
      </button>
    </div>

    <div class="flex items-center gap-[10px] h-fit shrink-0">
      <!-- Refresh button -->
      <button
        class="inline-flex items-center bg-card border border-border-primary rounded-[6px] text-text-primary cursor-pointer text-sm gap-1.5 px-3 py-[6.4px] transition-colors hover:not-disabled:bg-btn hover:not-disabled:border-border-focus disabled:opacity-50 disabled:cursor-default"
        :disabled="pending"
        @click="emit('refresh')"
      >
        <Icon name="lucide:refresh-cw" class="h-3.5 w-3.5" :class="{ 'animate-spin': pending }" />
        <span>Refresh</span>
      </button>

      <!-- Deploy a Branch button -->
      <button
        class="inline-flex items-center bg-blue-main border border-blue-main rounded-[6px] text-white cursor-pointer text-sm gap-1.5 px-3 py-[6.4px] transition-colors hover:bg-blue-main-hover hover:border-blue-main-hover"
        @click="emit('deployBranch')"
      >
        <Icon name="lucide:rocket" class="h-4 w-4" />
        <span>Deploy a Branch</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.select-custom-arrow {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23555'/%3E%3C/svg%3E");
}
</style>
