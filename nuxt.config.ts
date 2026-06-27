export default defineNuxtConfig({
  compatibilityDate: '2025-11-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxt/icon'],
  runtimeConfig: {
    githubToken: process.env.GITHUB_TOKEN ?? '',
    githubOwner: process.env.GITHUB_OWNER ?? '',
    githubRepo: process.env.GITHUB_REPO ?? '',
    projectToken: process.env.PROJECT_TOKEN ?? '',
    projectId: process.env.PROJECT_ID ?? '',
    teamId: process.env.TEAM_ID ?? '',
    jiraOrg: process.env.JIRA_ORG ?? '',
    jiraEmail: process.env.JIRA_EMAIL ?? '',
    jiraApiToken: process.env.JIRA_API_TOKEN ?? '',
    authUsername: process.env.AUTH_USERNAME ?? '',
    authPassword: process.env.AUTH_PASSWORD ?? '',
    authSecret: process.env.AUTH_SECRET ?? '',
    teamMembers: process.env.TEAM_MEMBERS ?? '',
    public: {
      jiraOrg: process.env.JIRA_ORG ?? '',
    },
  },
})