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

export function useDeployments() {
  const route = useRoute()
  const collapsed = ref((route.query.collapse as string) !== '0')
  const inspectingUid = ref<string | null>(null)
  const cancelling = ref<string | null>(null)

  const { data: resData, pending, error, refresh } = useFetch<DeploymentsResponse>('/api/deployments', {
    query: { collapse: collapsed },
  })

  const deployments = computed(() => resData.value?.deployments ?? [])
  const projectName = computed(() => resData.value?.projectName ?? '—')

  async function cancelDeployment(uid: string) {
    cancelling.value = uid
    try {
      await $fetch(`/api/deployments/${uid}/cancel`, { method: 'PATCH' })
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
