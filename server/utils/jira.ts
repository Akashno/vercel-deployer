export const JIRA_KEY_RE = /([A-Z]+-\d+)/

export function parseJiraKey(branch: string | null): string | null {
  if (!branch) return null
  const m = branch.match(JIRA_KEY_RE)
  return m ? m[1] : null
}
