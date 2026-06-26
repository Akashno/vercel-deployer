export default defineNuxtConfig({
  compatibilityDate: '2025-11-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxt/icon'],
  runtimeConfig: {
    public: {
      jiraOrg: process.env.JIRA_ORG ?? '',
    },
  },
})