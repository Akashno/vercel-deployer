/**
 * Copy text to the clipboard while tracking a transient "copied" state.
 *
 * The returned `copiedKey` holds the key of the most recently copied item and
 * automatically resets to `null` after `resetMs`. Pass a stable key per copy
 * target (e.g. a row id, an email, or a static string) so multiple buttons can
 * share one instance and each show its own "Copied!" feedback.
 */
export function useCopy(resetMs = 1500) {
  const copiedKey = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  async function copy(value: string, key = 'default'): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return false
    }
    copiedKey.value = key
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { copiedKey.value = null }, resetMs)
    return true
  }

  const isCopied = (key = 'default') => copiedKey.value === key

  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
  })

  return { copiedKey, copy, isCopied }
}
