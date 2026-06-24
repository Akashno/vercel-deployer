export default defineNuxtConfig({
  compatibilityDate: '2025-11-01',
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      jiraOrg: process.env.JIRA_ORG ?? '',
    },
  },
})
