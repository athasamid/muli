<script setup lang="ts">
import { CheckCircle2, RefreshCw, Sparkles, XCircle } from 'lucide-vue-next'

definePageMeta({ title: 'History', layout: 'dashboard' })

interface Session {
  command: string
  started_at: string
  ended_at: string
  items: number
  size: string
  operation_count: number
  failed_tasks: number
}
interface LocalEntry {
  id: string
  operation: string
  startedAt: string
  durationMs: number
  success: boolean
  error?: string | null
  dryRun: boolean
  targets: string[]
}

const sessions = ref<Session[]>([])
const localEntries = ref<LocalEntry[]>([])
const usingFallback = ref(false)
const loading = ref(true)

const OPERATION_NAMES: Record<string, string> = {
  clean: 'Smart Clean',
  uninstall: 'Uninstall',
  optimize: 'Optimize',
  purge: 'Developer Cleanup',
  installer: 'Installer Cleanup',
  analyze: 'Storage Scan',
  install: 'Mole Install',
}

const totalReclaimed = computed(() =>
  sessions.value.reduce((sum, session) => sum + parseMoleSize(session.size), 0),
)

const sessionsByDay = computed(() => {
  const days = new Map<string, Session[]>()
  for (const session of sessions.value) {
    const day = dayLabel(session.started_at)
    days.set(day, [...(days.get(day) ?? []), session])
  }
  return [...days.entries()]
})

function dayLabel(dateText: string) {
  const date = new Date(dateText.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return dateText
  const today = new Date()
  const yesterday = new Date(Date.now() - 86400000)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

function timeOf(dateText: string) {
  const date = new Date(dateText.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function durationOf(session: Session) {
  const start = new Date(session.started_at.replace(' ', 'T')).getTime()
  const end = new Date(session.ended_at.replace(' ', 'T')).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return ''
  const seconds = Math.round((end - start) / 1000)
  return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m`
}

async function load() {
  loading.value = true
  usingFallback.value = false
  try {
    const data = await (window as any).mole.history()
    sessions.value = Array.isArray(data?.sessions) ? data.sessions : []
  } catch {
    usingFallback.value = true
    try {
      localEntries.value = await (window as any).moleHistory.list()
    } catch {
      localEntries.value = []
    }
  }
  loading.value = false
}

onMounted(load)
</script>

<template>
  <div class="mx-auto w-full max-w-[960px] px-6 py-8">
    <div class="mb-8 flex items-start justify-between gap-4">
      <div><h1 class="text-2xl font-bold tracking-tight">History</h1><p class="mt-1 text-sm text-muted-foreground">Everything Mole has cleaned on this Mac.</p></div>
      <Button variant="outline" size="sm" @click="load"><RefreshCw class="h-4 w-4" /> Refresh</Button>
    </div>

    <div v-if="loading" class="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Loading history…</div>

    <template v-else-if="!usingFallback">
      <div class="mb-6 rounded-xl border bg-card p-5">
        <div class="flex items-center gap-3">
          <Sparkles class="h-6 w-6 text-primary" />
          <div>
            <div class="text-2xl font-bold">{{ formatBytes(totalReclaimed) }}</div>
            <div class="text-sm text-muted-foreground">total space reclaimed across {{ sessions.length }} operation{{ sessions.length === 1 ? '' : 's' }}</div>
          </div>
        </div>
      </div>

      <div v-if="!sessions.length" class="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No cleanup activity recorded yet.</div>
      <div v-else class="space-y-6">
        <div v-for="[day, daySessions] in sessionsByDay" :key="day">
          <h2 class="mb-2 text-sm font-semibold text-muted-foreground">{{ day }}</h2>
          <div class="space-y-2">
            <div v-for="session in daySessions" :key="`${session.command}-${session.started_at}`" class="flex items-center gap-3 rounded-xl border bg-card p-4">
              <CheckCircle2 v-if="!session.failed_tasks" class="h-5 w-5 shrink-0 text-green-600" />
              <XCircle v-else class="h-5 w-5 shrink-0 text-destructive" />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold">{{ OPERATION_NAMES[session.command] ?? session.command }}</span>
                  <span v-if="session.failed_tasks" class="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{{ session.failed_tasks }} failed</span>
                </div>
                <p class="mt-0.5 text-sm text-muted-foreground">
                  {{ timeOf(session.started_at) }}<template v-if="durationOf(session)"> · {{ durationOf(session) }}</template><template v-if="session.items"> · {{ session.items }} item{{ session.items === 1 ? '' : 's' }}</template>
                </p>
              </div>
              <span class="shrink-0 font-semibold" :class="parseMoleSize(session.size) > 0 ? 'text-green-600' : 'text-muted-foreground'">
                {{ parseMoleSize(session.size) > 0 ? `${session.size} freed` : '—' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <p class="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">Mole history is unavailable — showing Muli's local activity log instead.</p>
      <div v-if="!localEntries.length" class="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No operations recorded yet.</div>
      <div v-else class="space-y-3">
        <div v-for="entry in localEntries" :key="entry.id" class="rounded-xl border bg-card p-4">
          <div class="flex items-start gap-3">
            <CheckCircle2 v-if="entry.success" class="mt-0.5 h-5 w-5 text-green-600" /><XCircle v-else class="mt-0.5 h-5 w-5 text-destructive" />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold">{{ OPERATION_NAMES[entry.operation] ?? entry.operation }}</span>
                <span v-if="entry.dryRun" class="rounded bg-muted px-2 py-0.5 text-xs">Preview</span>
                <span v-if="!entry.success" class="text-sm text-destructive">{{ entry.error || 'Failed' }}</span>
              </div>
              <p class="mt-1 text-sm text-muted-foreground">{{ new Date(entry.startedAt).toLocaleString() }}</p>
              <p v-if="entry.targets.length" class="mt-2 text-sm">{{ entry.targets.join(', ') }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
