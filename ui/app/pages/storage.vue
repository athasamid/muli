<script setup lang="ts">
import { ChevronRight, Copy, FolderOpen, FolderSearch, HardDrive, Loader2, RefreshCw, Sparkles, X } from 'lucide-vue-next'

definePageMeta({ title: 'Storage', layout: 'dashboard' })

interface Entry {
  name: string
  path: string
  size: number
  is_dir: boolean
  last_access?: string
  insight?: boolean
  cleanable?: boolean
}
interface Crumb { name: string, path: string | null }

type State = 'scanning' | 'ready' | 'error'

const state = ref<State>('scanning')
const entries = ref<Entry[]>([])
const insights = ref<Entry[]>([])
const crumbs = ref<Crumb[]>([{ name: 'Overview', path: null }])
const scannedAt = ref<string | null>(null)
const cached = ref(false)
const cliLine = ref('')
const errorText = ref('')
const copiedPath = ref('')
const disk = ref<{ total: number, free: number } | null>(null)
let mole: any
let system: any

const totalListed = computed(() => entries.value.reduce((sum, entry) => sum + entry.size, 0))
const isOverview = computed(() => crumbs.value[crumbs.value.length - 1]?.path === null)

onMounted(() => {
  mole = (window as any).mole
  system = (window as any).system
  mole.onAnalyzeStatus((status: { line: string }) => { cliLine.value = status.line })
  system.stats().then((stats: any) => { disk.value = stats?.disk ?? null }).catch(() => {})
  load(null)
})

onUnmounted(() => {
  if (state.value === 'scanning') mole?.cancelScan?.()
})

async function load(path: string | null, refresh = false) {
  state.value = 'scanning'
  errorText.value = ''
  cliLine.value = ''
  try {
    const result = await mole.analyze({ path: path ?? undefined, refresh })
    const all: Entry[] = Array.isArray(result?.entries) ? result.entries : []
    insights.value = path ? [] : all.filter(entry => entry.insight)
    entries.value = (path ? all : all.filter(entry => !entry.insight))
      .slice()
      .sort((a, b) => b.size - a.size)
    scannedAt.value = result?.scannedAt ?? null
    cached.value = Boolean(result?.cached)
    state.value = 'ready'
  } catch (error: any) {
    errorText.value = friendlyError(error?.message)
    state.value = 'error'
  }
}

function friendlyError(message?: string) {
  if (message?.includes('mole_not_found')) return 'Mole is required for this feature.'
  if (message?.includes('scan_in_progress')) return 'Another scan is still running.'
  if (message?.includes('invalid_path')) return 'This folder can no longer be found.'
  return 'The storage scan did not finish successfully.'
}

function drill(entry: Entry) {
  if (!entry.is_dir) return
  crumbs.value = [...crumbs.value, { name: entry.name, path: entry.path }]
  load(entry.path)
}

function jump(index: number) {
  const crumb = crumbs.value[index]
  if (!crumb) return
  crumbs.value = crumbs.value.slice(0, index + 1)
  load(crumb.path)
}

function rescan() {
  const current = crumbs.value[crumbs.value.length - 1]
  load(current?.path ?? null, true)
}

function cancelScan() {
  mole.cancelScan()
  state.value = crumbs.value.length > 1 ? 'ready' : 'error'
  if (state.value === 'error') errorText.value = 'Scan canceled.'
}

function percent(entry: Entry) {
  if (!totalListed.value) return 0
  return Math.max(1, Math.round((entry.size / totalListed.value) * 100))
}

async function copyPath(entry: Entry) {
  await system.copy(entry.path)
  copiedPath.value = entry.path
  setTimeout(() => { if (copiedPath.value === entry.path) copiedPath.value = '' }, 1500)
}

function lastOpened(entry: Entry) {
  if (!entry.last_access) return ''
  return new Date(entry.last_access).toLocaleDateString()
}
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] px-6 py-8">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Storage</h1>
        <p class="mt-1 text-sm text-muted-foreground">See what fills your disk and drill into the biggest folders.</p>
      </div>
      <div class="flex gap-2">
        <Button v-if="state === 'scanning'" variant="outline" size="sm" @click="cancelScan"><X class="h-4 w-4" /> Cancel</Button>
        <Button v-else variant="outline" size="sm" @click="rescan"><RefreshCw class="h-4 w-4" /> Rescan</Button>
      </div>
    </div>

    <div v-if="disk" class="mb-6 rounded-xl border bg-card p-5">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3"><HardDrive class="h-5 w-5 text-primary" /><span class="font-semibold">Macintosh HD</span></div>
        <span class="text-sm text-muted-foreground">{{ formatBytes(disk.total - disk.free) }} used · {{ formatBytes(disk.free) }} free of {{ formatBytes(disk.total) }}</span>
      </div>
      <div class="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div class="h-full bg-primary" :style="{ width: `${Math.round(((disk.total - disk.free) / disk.total) * 100)}%` }" /></div>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-1 text-sm">
      <template v-for="(crumb, index) in crumbs" :key="crumb.path ?? 'root'">
        <ChevronRight v-if="index > 0" class="h-4 w-4 text-muted-foreground" />
        <button
          type="button"
          class="rounded px-1.5 py-0.5 hover:bg-muted"
          :class="index === crumbs.length - 1 ? 'font-semibold' : 'text-muted-foreground'"
          @click="jump(index)"
        >{{ crumb.name }}</button>
      </template>
      <span v-if="state === 'ready' && scannedAt && isOverview" class="ml-auto text-xs text-muted-foreground">
        Scanned {{ timeAgo(scannedAt) }}<template v-if="cached"> · cached</template>
      </span>
    </div>

    <div v-if="state === 'scanning'" class="space-y-3 rounded-xl border bg-card p-6">
      <div class="flex items-center gap-3 text-sm font-medium"><Loader2 class="h-5 w-5 animate-spin" /> Analyzing storage…</div>
      <div class="h-2 overflow-hidden rounded-full bg-muted"><div class="h-full w-1/3 animate-pulse rounded-full bg-primary" /></div>
      <p class="text-xs text-muted-foreground">The first machine-wide scan can take a few minutes. Folder scans are much faster.</p>
      <p v-if="cliLine" class="rounded bg-muted px-3 py-2 font-mono text-xs break-all">{{ cliLine }}</p>
    </div>

    <div v-else-if="state === 'error'" class="rounded-xl border bg-card p-6">
      <p class="text-sm text-destructive">{{ errorText }}</p>
      <Button class="mt-4" variant="outline" size="sm" @click="rescan"><RefreshCw class="h-4 w-4" /> Try again</Button>
    </div>

    <template v-else>
      <div v-if="insights.length" class="mb-6">
        <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Sparkles class="h-4 w-4" /> Worth a look</h2>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="entry in insights" :key="entry.path" class="rounded-xl border bg-card p-4">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="truncate font-semibold">{{ entry.name }}</div>
                <div class="mt-0.5 truncate text-xs text-muted-foreground" :title="entry.path">{{ entry.path }}</div>
              </div>
              <span class="shrink-0 text-sm font-semibold">{{ formatBytes(entry.size) }}</span>
            </div>
            <div class="mt-3 flex items-center gap-1.5">
              <span v-if="entry.cleanable" class="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Cleanable with Smart Clean</span>
              <Button variant="ghost" size="sm" class="ml-auto h-7 px-2" title="Reveal in Finder" @click="system.reveal(entry.path)"><FolderOpen class="h-3.5 w-3.5" /></Button>
              <Button v-if="entry.is_dir" variant="ghost" size="sm" class="h-7 px-2" title="Explore" @click="drill(entry)"><FolderSearch class="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!entries.length" class="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Nothing sizeable found in this folder.</div>
      <div v-else class="overflow-hidden rounded-xl border bg-card">
        <div
          v-for="entry in entries"
          :key="entry.path"
          class="group flex w-full items-center gap-3 border-b px-4 py-3 text-left transition last:border-b-0 hover:bg-muted/50"
          :class="entry.is_dir ? 'cursor-pointer' : 'cursor-default'"
          @click="drill(entry)"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate font-medium">{{ entry.name }}</span>
              <ChevronRight v-if="entry.is_dir" class="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </div>
            <div class="mt-1 flex items-center gap-2">
              <div class="h-1.5 w-32 overflow-hidden rounded-full bg-muted"><div class="h-full rounded-full bg-primary/70" :style="{ width: `${percent(entry)}%` }" /></div>
              <span class="text-xs text-muted-foreground">{{ percent(entry) }}%</span>
              <span v-if="lastOpened(entry)" class="text-xs text-muted-foreground">· Last opened {{ lastOpened(entry) }}</span>
            </div>
            <div class="mt-0.5 truncate text-xs text-muted-foreground" :title="entry.path">{{ entry.path }}</div>
          </div>
          <span class="shrink-0 text-sm font-semibold">{{ formatBytes(entry.size) }}</span>
          <span class="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
            <Button variant="ghost" size="sm" class="h-7 px-2" title="Reveal in Finder" @click.stop="system.reveal(entry.path)"><FolderOpen class="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="sm" class="h-7 px-2" :title="copiedPath === entry.path ? 'Copied!' : 'Copy path'" @click.stop="copyPath(entry)"><Copy class="h-3.5 w-3.5" :class="copiedPath === entry.path ? 'text-green-600' : ''" /></Button>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
