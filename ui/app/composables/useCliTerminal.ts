// Renders raw pty output like a real terminal: a carriage return rewinds to
// the start of the line, so spinner frames overwrite each other instead of
// piling up. Keeps the log box scrolled to the bottom unless the user
// scrolled up to inspect something.
export function useCliTerminal() {
  const raw = ref('')
  const box = ref<HTMLElement | null>(null)

  const text = computed(() => {
    const normalized = raw.value.replace(/\r\n/g, '\n')
    return normalized
      .split('\n')
      .map(line => line.split('\r').pop() ?? '')
      .join('\n')
  })

  watch(text, () => {
    const el = box.value
    const stick = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80
    nextTick(() => {
      if (stick && box.value) box.value.scrollTop = box.value.scrollHeight
    })
  })

  function append(chunk: string) {
    raw.value += chunk
  }

  function reset() {
    raw.value = ''
  }

  return { text, box, append, reset }
}
