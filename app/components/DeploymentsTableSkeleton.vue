<script setup lang="ts">
withDefaults(defineProps<{ rows?: number }>(), { rows: 6 })
</script>

<template>
  <!-- Mobile card list skeleton (hidden on md+) -->
  <div class="flex flex-col gap-2 md:hidden animate-pulse">
    <div
      v-for="i in rows"
      :key="i"
      class="border border-border-secondary rounded-[8px] bg-card px-4 py-3.5 flex flex-col gap-3"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1 space-y-2">
          <div class="h-3.5 w-40 bg-border-secondary rounded" />
          <div class="h-3 w-56 bg-border-secondary rounded" />
        </div>
        <div class="h-4 w-16 bg-border-secondary rounded shrink-0" />
      </div>
      <div class="flex items-center gap-2">
        <div class="h-3 w-3 bg-border-secondary rounded-full" />
        <div class="h-3 w-20 bg-border-secondary rounded" />
        <div class="h-3 w-12 bg-border-secondary rounded" />
      </div>
      <div class="flex items-center gap-2">
        <div class="h-6 w-6 bg-border-secondary rounded-[4px]" />
        <div class="h-6 w-6 bg-border-secondary rounded-[4px]" />
        <div class="h-6 w-16 bg-border-secondary rounded-[4px]" />
      </div>
    </div>
  </div>

  <!-- Desktop table skeleton (hidden below md) -->
  <div class="hidden md:block border border-border-secondary rounded-[8px] overflow-hidden">
    <table class="table-auto border-collapse text-sm w-full">
      <thead>
        <tr class="border-b border-border-secondary">
          <th scope="col" class="text-text-tertiary text-[11px] font-medium tracking-[0.06em] px-4 py-2.5 text-left uppercase whitespace-nowrap">Branch / Commit</th>
          <th scope="col" class="text-text-tertiary text-[11px] font-medium tracking-[0.06em] px-4 py-2.5 text-left uppercase whitespace-nowrap">Status</th>
          <th scope="col" class="text-text-tertiary text-[11px] font-medium tracking-[0.06em] px-4 py-2.5 text-left uppercase whitespace-nowrap">Created At</th>
          <th scope="col" class="text-text-tertiary text-[11px] font-medium tracking-[0.06em] px-4 py-2.5 text-left uppercase whitespace-nowrap">Commit Author</th>
          <th scope="col" class="text-text-tertiary text-[11px] font-medium tracking-[0.06em] px-4 py-2.5 text-left uppercase whitespace-nowrap">Actions</th>
        </tr>
      </thead>
      <tbody class="animate-pulse">
        <tr v-for="i in rows" :key="i" class="group">
          <td class="border-b border-border-secondary group-last:border-b-0 px-4 py-[13px] align-middle">
            <div class="h-3.5 w-40 bg-border-secondary rounded" />
            <div class="flex items-baseline gap-[6.4px] mt-2">
              <div class="h-3 w-14 bg-border-secondary rounded" />
              <div class="h-3 w-48 bg-border-secondary rounded" />
            </div>
          </td>
          <td class="border-b border-border-secondary group-last:border-b-0 px-4 py-[13px] align-middle">
            <div class="h-4 w-16 bg-border-secondary rounded" />
          </td>
          <td class="border-b border-border-secondary group-last:border-b-0 px-4 py-[13px] align-middle">
            <div class="h-3 w-14 bg-border-secondary rounded mb-2" />
            <div class="h-2.5 w-10 bg-border-secondary rounded" />
          </td>
          <td class="border-b border-border-secondary group-last:border-b-0 px-4 py-[13px] align-middle">
            <div class="flex items-center gap-1.5">
              <div class="h-4 w-4 bg-border-secondary rounded-full shrink-0" />
              <div class="h-3 w-24 bg-border-secondary rounded" />
            </div>
          </td>
          <td class="border-b border-border-secondary group-last:border-b-0 px-4 py-[13px] align-middle">
            <div class="flex items-center gap-2">
              <div class="h-6 w-6 bg-border-secondary rounded-[4px]" />
              <div class="h-6 w-6 bg-border-secondary rounded-[4px]" />
              <div class="h-6 w-[70px] bg-border-secondary rounded-[4px]" />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
