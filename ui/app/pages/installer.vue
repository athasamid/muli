<script setup lang="ts">
import { AlertTriangle, Check, FolderOpen, Loader2, Package, RefreshCw, Trash2 } from 'lucide-vue-next'

definePageMeta({ title: 'Installer Cleanup', layout: 'dashboard' })

interface Installer {
  name: string
  size: string
  bytes: number
  location: string
  type: string
  path: string | null
}
interface TrashResult { trashed: string[], failed: { path: string, error: string }[] }

type State = 'scanning' | 'ready' | 'confirm' | 'removing' | 'done' | 'error'

const state = ref<State>('scanning')
const items = ref<Installer[]>([])
const selected = ref<string[]>([])
const cliLine = ref('')
const errorText = ref('')
const result = ref<TrashResult | null>(null)
let mole: any
let system: any

const groups = computed(() => {
  const byType = new Map<string, { type: string, bytes: number, items: Installer[] }>()
  for (const item of items.value) {
    const group = byType.get(item.type) ?? { type: item.type, bytes: 0, items: [] }
    group.bytes += item.bytes
    group.items.push(item)
    byType.set(item.type, group)
  }
  return [...byType.values()].sort((a, b) => b.bytes - a.bytes)
})
const selectedItems = computed(() => items.value.filter(item => item.path && selected.value.includes(item.path)))
const selectedBytes = computed(() => selectedItems.value.reduce((sum, item) => sum + item.bytes, 0))
const selectableCount = computed(() => items.value.filter(item => item.path).length)

onMounted(() => {
  mole = (window as any).mole
  system = (window as any).system
  mole.onInstallerScanStatus((status: { line: string }) => { cliLine.value = status.line })
  scan()
})

onUnmounted(() => {
  if (state.value === 'scanning') mole?.cancelScan?.()
})

function friendlyError(message?: string) {
  if (message?.includes('mole_not_found')) return 'Mole is required for this feature.'
  if (message?.includes('scan_in_progress')) return 'Another scan is still running.'
  return 'The installer scan did not finish successfully.'
}

async function scan() {
  state.value = 'scanning'
  errorText.value = ''
  cliLine.value = ''
  selected.value = []
  result.value = null
  try {
    items.value = await mole.installerList()
    state.value = 'ready'
  } catch (error: any) {
    errorText.value = friendlyError(error?.message)
    state.value = 'error'
  }
}

function toggle(item: Installer) {
  if (!item.path) return
  selected.value = selected.value.includes(item.path)
    ? selected.value.filter(path => path !== item.path)
    : [...selected.value, item.path]
}

function selectAll() {
  const all = items.value.map(item => item.path).filter((path): path is string => Boolean(path))
  selected.value = selected.value.length === all.length ? [] : all
}

async function removeSelected() {
  state.value = 'removing'
  try {
    result.value = await mole.trashInstallers([...selected.value])
    state.value = 'done'
  } catch (error: any) {
    errorText.value = error?.message || 'Could not move the files to Trash.'
    state.value = 'done'
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-[1000px] px-6 py-8">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Installer Cleanup</h1>
        <p class="mt-1 text-sm text-muted-foreground">Leftover .dmg, .pkg and other installers you probably no longer need. Removed files go to the Trash.</p>
      </div>
      <div class="flex gap-2">
        <Button v-if="state === 'ready' || state === 'done' || state === 'error'" variant="outline" size="sm" @click="scan"><RefreshCw class="h-4 w-4" /> Scan again</Button>
        <Button v-if="state === 'ready'" variant="destructive" :disabled="!selected.length" @click="state = 'confirm'">
          <Trash2 class="h-4 w-4" /> Move to Trash — {{ formatBytes(selectedBytes) }}
        </Button>
      </div>
    </div>

    <div v-if="state === 'scanning'" class="space-y-3 rounded-xl border bg-card p-6">
      <div class="flex items-center gap-3 text-sm font-medium"><Loader2 class="h-5 w-5 animate-spin" /> Looking for installer files…</div>
      <div class="h-2 overflow-hidden rounded-full bg-muted"><div class="h-full w-1/3 animate-pulse rounded-full bg-primary" /></div>
      <p v-if="cliLine" class="rounded bg-muted px-3 py-2 font-mono text-xs break-all">{{ cliLine }}</p>
    </div>

    <div v-else-if="state === 'error'" class="rounded-xl border bg-card p-6">
      <p class="text-sm text-destructive">{{ errorText }}</p>
      <Button class="mt-4" variant="outline" size="sm" @click="scan"><RefreshCw class="h-4 w-4" /> Try again</Button>
    </div>

    <template v-else-if="state === 'ready'">
      <div v-if="!items.length" class="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No installer files found. Nothing to clean up.</div>
      <template v-else>
        <div class="mb-4 flex items-center justify-between">
          <p class="text-sm text-muted-foreground">{{ items.length }} file{{ items.length === 1 ? '' : 's' }} found · {{ selected.length }} selected</p>
          <Button variant="ghost" size="sm" @click="selectAll">{{ selected.length === selectableCount ? 'Deselect all' : 'Select all' }}</Button>
        </div>
        <div class="space-y-4">
          <div v-for="group in groups" :key="group.type" class="overflow-hidden rounded-xl border bg-card">
            <div class="flex items-center gap-3 border-b bg-muted/30 px-4 py-2.5">
              <Package class="h-4 w-4 text-primary" />
              <span class="font-semibold uppercase">{{ group.type }}</span>
              <span class="text-sm text-muted-foreground">{{ group.items.length }} file{{ group.items.length === 1 ? '' : 's' }}</span>
              <span class="ml-auto text-sm font-semibold">{{ formatBytes(group.bytes) }}</span>
            </div>
            <div
              v-for="item in group.items"
              :key="item.name"
              class="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0"
              :class="item.path ? 'cursor-pointer hover:bg-muted/50' : 'opacity-60'"
              @click="toggle(item)"
            >
              <input class="h-4 w-4 accent-primary" type="checkbox" :checked="item.path ? selected.includes(item.path) : false" :disabled="!item.path" tabindex="-1" />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium">{{ item.name }}</div>
                <div class="truncate text-xs text-muted-foreground">{{ item.path ?? `${item.location} — file location could not be verified` }}</div>
              </div>
              <span class="shrink-0 text-sm">{{ item.size }}</span>
              <Button v-if="item.path" variant="ghost" size="sm" class="h-7 shrink-0 px-2" title="Reveal in Finder" @click.stop="system.reveal(item.path)"><FolderOpen class="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </div>
      </template>
    </template>

    <div v-else-if="state === 'confirm'" class="max-w-lg rounded-xl border bg-card p-5 space-y-4">
      <div class="flex gap-3">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <h2 class="font-semibold">Move {{ selectedItems.length }} file{{ selectedItems.length === 1 ? '' : 's' }} to Trash — {{ formatBytes(selectedBytes) }}?</h2>
          <p class="mt-1 text-sm text-muted-foreground">Files go to the macOS Trash, so you can restore them until the Trash is emptied.</p>
        </div>
      </div>
      <ul class="max-h-48 space-y-1 overflow-auto rounded-lg bg-muted p-3 text-xs">
        <li v-for="item in selectedItems" :key="item.path!" class="truncate">{{ item.path }} — {{ item.size }}</li>
      </ul>
      <div class="flex gap-2">
        <Button variant="outline" @click="state = 'ready'">Back</Button>
        <Button variant="destructive" @click="removeSelected">Move to Trash</Button>
      </div>
    </div>

    <div v-else-if="state === 'removing'" class="rounded-xl border bg-card p-6">
      <div class="flex items-center gap-3 text-sm font-medium"><Loader2 class="h-5 w-5 animate-spin" /> Moving files to Trash…</div>
    </div>

    <div v-else class="space-y-4 rounded-xl border bg-card p-5">
      <div class="flex items-center gap-2 font-medium">
        <Check v-if="result && !result.failed.length && !errorText" class="h-4 w-4 text-green-600" />
        <AlertTriangle v-else class="h-4 w-4 text-destructive" />
        <template v-if="result">{{ result.trashed.length }} file{{ result.trashed.length === 1 ? '' : 's' }} moved to Trash.</template>
        <template v-else>{{ errorText }}</template>
      </div>
      <div v-if="result?.failed.length" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
        <p class="font-medium text-destructive">Could not move:</p>
        <p v-for="failure in result.failed" :key="failure.path" class="mt-1 truncate text-xs">{{ failure.path }}</p>
      </div>
      <Button variant="outline" size="sm" @click="scan"><RefreshCw class="h-4 w-4" /> Scan again</Button>
    </div>
  </div>
</template>
