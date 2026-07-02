<script setup lang="ts">
const {
  projectName,
  deployments,
  pending,
  error,
  refresh,
  collapsed,
  inspectingUid,
  cancelling,
  cancelDeployment,
} = useDeployments()

const {
  pendingDeployments,
  fdErrors,
  confirmPending,
  deployBranchDialog,
  forceDeploy,
  confirmForceDeploy,
  openDeployBranchDialog,
  handleDeployBranch,
} = useForceDeploy(deployments, refresh)

const {
  search,
  filterStatus,
  filterAuthor,
  hasFilters,
  clearFilters,
  uniqueStatuses,
  uniqueAuthors,
  filteredDeployments,
} = useDeploymentsFilters(deployments, pendingDeployments, collapsed, inspectingUid)

onMounted(() => {
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (confirmPending.value) confirmPending.value = null
      if (deployBranchDialog.value.open) deployBranchDialog.value.open = false
    }
  }
  window.addEventListener('keydown', onKeydown)
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
  })
})

const showSettingsModal = ref(false)
</script>

<template>
  <div class="max-w-[1400px] mx-auto py-5 px-4 sm:py-8 sm:px-6 text-text-primary min-h-screen">
    <!-- Header -->
    <DashboardHeader
      :project-name="projectName"
      :deployments-count="filteredDeployments.length"
      :has-data="!!deployments.length"
      @open-settings="showSettingsModal = true"
    />

    <!-- Filter and Controls bar -->
    <DeploymentFilters
      v-model:search="search"
      v-model:filter-status="filterStatus"
      v-model:filter-author="filterAuthor"
      :unique-statuses="uniqueStatuses"
      :unique-authors="uniqueAuthors"
      :pending="pending"
      :has-filters="hasFilters"
      :has-data="!!deployments.length"
      @refresh="refresh"
      @deploy-branch="openDeployBranchDialog"
      @clear-filters="clearFilters"
    />

    <!-- Loading / Empty states -->
    <div v-if="pending && !deployments.length" class="flex flex-col items-center justify-center py-20 text-text-tertiary text-[15px] gap-3">
      <Icon name="lucide:loader-2" class="animate-spin h-6 w-6 text-zinc-500" />
      <span>Loading deployments…</span>
    </div>

    <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-red-text text-[15px] gap-3">
      <Icon name="lucide:alert-triangle" class="h-6 w-6 text-rose-500" />
      <span>{{ error.message }}</span>
    </div>

    <div v-else-if="!filteredDeployments.length" class="flex flex-col items-center justify-center py-20 text-text-tertiary text-[15px] gap-3">
      <span>No deployments found{{ hasFilters ? ' for the active filters' : '' }}.</span>
    </div>

    <!-- Deployments Table -->
    <DeploymentsTable
      v-else
      :deployments="filteredDeployments"
      :pending-deployments="pendingDeployments"
      :cancelling="cancelling"
      :fd-errors="fdErrors"
      v-model:collapsed="collapsed"
      @inspect="uid => inspectingUid = uid"
      @cancel="(e, uid) => cancelDeployment(uid)"
      @force-deploy="(e, uid, branch) => forceDeploy(e, uid, branch)"
    />

    <!-- Modals -->
    <DeployBranchDialog
      v-model="deployBranchDialog.open"
      :initial-branch="deployBranchDialog.selectedBranch"
      @deploy="handleDeployBranch"
    />

    <ConfirmForceDeployDialog
      :model-value="!!confirmPending"
      :branch="confirmPending?.branch ?? ''"
      @update:model-value="val => { if (!val) confirmPending = null }"
      @confirm="confirmForceDeploy"
    />

     <DeploymentDetailDrawer
      :uid="inspectingUid"
      @close="inspectingUid = null"
    />

    <SettingsDialog v-model="showSettingsModal" />
  </div>
</template>


