<script setup lang="ts">
useHead({
  script: [
    {
      innerHTML: `
        (function() {
          const theme = localStorage.getItem('theme') || 'dark';
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        })()
      `,
      type: 'text/javascript'
    }
  ]
})
</script>

<template>
  <NuxtPage />
</template>

<style>
@import "~/assets/css/tailwind.css";
</style>
