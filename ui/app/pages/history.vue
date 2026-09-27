<script setup lang="ts">
import { CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-vue-next'

definePageMeta({ title: 'History', layout: 'dashboard' })

interface Entry {
  id: string
  operation: string
  startedAt: string
  durationMs: number
  success: boolean
  error?: string | null
  dryRun: boolean
  targets: string[]
  summary?: string | null
}

const entries = ref<Entry[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  entries.value = await (window as any).moleHistory.list()
  loading.value = false
}

function formatDuration(ms: number) {
  return ms < 1000 ? '<1s' : `${Math.round(ms / 1000)}s`
}

onMounted(load)
</script>

<template>
  <div class="mx-auto w-full max-w-[960px] px-6 py-8">
    <div class="mb-8 flex items-start justify-between gap-4">
      <div><h1 class="text-2xl font-bold tracking-tight">History</h1><p class="mt-1 text-sm text-muted-foreground">Local audit for Mole operations.</p></div>
      <Button variant="outline" size="sm" @click="load"><RefreshCw class="h-4 w-4" /> Refresh</Button>
    </div>
    <div v-if="loading" class="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Loading history…</div>
    <div v-else-if="!entries.length" class="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No operations recorded yet.</div>
    <div v-else class="space-y-3">
      <div v-for="entry in entries" :key="entry.id" class="rounded-xl border bg-card p-4">
        <div class="flex items-start gap-3">
          <CheckCircle2 v-if="entry.success" class="mt-0.5 h-5 w-5 text-green-600" /><XCircle v-else class="mt-0.5 h-5 w-5 text-destructive" />
          <div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><span class="font-semibold capitalize">{{ entry.operation }}</span><span v-if="entry.dryRun" class="rounded bg-muted px-2 py-0.5 text-xs">Preview</span><span v-if="!entry.success" class="text-sm text-destructive">{{ entry.error || 'Failed' }}</span></div><p class="mt-1 text-sm text-muted-foreground">{{ new Date(entry.startedAt).toLocaleString() }} · {{ formatDuration(entry.durationMs) }}</p><p v-if="entry.targets.length" class="mt-2 text-sm">{{ entry.targets.join(', ') }}</p></div>
        </div>
      </div>
    </div>
  </div>
</template>
