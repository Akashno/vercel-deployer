import type { Ref, ComputedRef } from 'vue'
import type { Deployment } from './useDeployments'

export function useDeploymentsFilters(
  projectId: Ref<string | null>,
  deployments: Ref<Deployment[]> | ComputedRef<Deployment[]>,
  pendingDeployments: Ref<Deployment[]> | ComputedRef<Deployment[]>,
  collapsed: Ref<boolean>,
  inspectingUid: Ref<string | null>
) {
  const route = useRoute()
  const router = useRouter()

  const search = ref((route.query.q as string) ?? '')
  const filterStatus = ref((route.query.status as string) ?? '')
  const filterAuthor = ref((route.query.author as string) ?? '')

  function syncUrl() {
    const query: Record<string, string> = {}
    if (projectId.value) query.project = projectId.value
    if (search.value) query.q = search.value
    if (filterStatus.value) query.status = filterStatus.value
    if (filterAuthor.value) query.author = filterAuthor.value
    if (!collapsed.value) query.collapse = '0'
    if (inspectingUid.value) query.inspect = inspectingUid.value
    router.replace({ query })
  }

  // Watch filters to sync URLs
  watch([projectId, filterStatus, filterAuthor, collapsed, inspectingUid], syncUrl)

  // Debounce search URL sync
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  watch(search, () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(syncUrl, 300)
  })

  onUnmounted(() => {
    if (searchTimer !== null) clearTimeout(searchTimer)
  })

  const hasFilters = computed(() =>
    !!(search.value || filterStatus.value || filterAuthor.value)
  )

  function clearFilters() {
    search.value = ''
    filterStatus.value = ''
    filterAuthor.value = ''
    syncUrl()
  }

  const uniqueStatuses = computed(() =>
    [...new Set((deployments.value ?? []).map(d => d.state).filter(Boolean))] as string[]
  )

  const uniqueAuthors = computed(() =>
    [...new Set((deployments.value ?? []).map(d => d.commitAuthor).filter(Boolean))] as string[]
  )

  const filteredDeployments = computed(() => {
    const real = (deployments.value ?? []).filter((d) => {
      if (filterStatus.value && d.state?.toUpperCase() !== filterStatus.value.toUpperCase()) return false
      if (filterAuthor.value && d.commitAuthor !== filterAuthor.value) return false
      const q = search.value.toLowerCase().trim()
      if (q) {
        return (
          (d.branch ?? '').toLowerCase().includes(q) ||
          (d.commitMessage ?? '').toLowerCase().includes(q) ||
          (d.commitAuthor ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
    return [...pendingDeployments.value, ...real]
  })

  return {
    search,
    filterStatus,
    filterAuthor,
    hasFilters,
    clearFilters,
    uniqueStatuses,
    uniqueAuthors,
    filteredDeployments,
  }
}
