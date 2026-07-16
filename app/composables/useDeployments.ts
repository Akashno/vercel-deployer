import type { Ref } from 'vue'

export interface Deployment {
  uid: string
  state: string
  target: string | null
  createdAt: number | null
  inspectorUrl: string | null
  branch: string | null
  commitSha: string | null
  commitMessage: string | null
  commitAuthor: string | null
  deployer?: string | null
  prUrl?: string | null
  prId?: string | null
  _pending?: boolean
  _originUid?: string
  _githubRunUrl?: string | null
}

interface DeploymentsResponse {
  projectName: string
  deployments: Deployment[]
}

export function useDeployments(projectId: Ref<string | null>) {
  const route = useRoute()
  const collapsed = ref((route.query.collapse as string) !== '0')
  const inspectingUid = ref<string | null>(null)
  const cancelling = ref<string | null>(null)

  // watch:false disables useFetch's implicit re-fetch on reactive URL/query changes, so
  // fetches are driven solely by the explicit watchers below — one request per change,
  // never the duplicate (auto-watch + manual) that would otherwise fire on a project swap.
  const { data: resData, pending, error, refresh } = useFetch<DeploymentsResponse>(
    () => `/api/projects/${projectId.value}/deployments`,
    {
      query: { collapse: collapsed },
      immediate: false,
      watch: false,
    }
  )

  // Fetch once the project resolves, and on every subsequent project change. Clearing
  // resData on a project *change* drops the previous project's rows so the loading
  // skeleton shows during the swap, while a same-project refresh() keeps the table visible.
  watch(projectId, (id, prevId) => {
    if (!id) return
    if (prevId) resData.value = null
    refresh()
  }, { immediate: true })

  // Collapse toggling changes server-side grouping, so it needs its own refetch.
  watch(collapsed, () => {
    if (projectId.value) refresh()
  })

  const deployments = computed(() => resData.value?.deployments ?? [])
  const projectName = computed(() => resData.value?.projectName ?? '—')

  async function cancelDeployment(uid: string) {
    if (!projectId.value) return
    cancelling.value = uid
    try {
      await $fetch(`/api/projects/${projectId.value}/deployments/${uid}/cancel`, { method: 'PATCH' })
      await refresh()
    } finally {
      cancelling.value = null
    }
  }

  // Setup inspect ref from query param if available
  onMounted(() => {
    if (route.query.inspect) {
      inspectingUid.value = route.query.inspect as string
    }
  })

  return {
    projectName,
    deployments,
    pending,
    error,
    refresh,
    collapsed,
    inspectingUid,
    cancelling,
    cancelDeployment,
  }
}
