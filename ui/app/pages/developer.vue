<script setup lang="ts">
import { AlertTriangle, Check, ChevronDown, ChevronRight, Code2, Loader2, RefreshCw, Trash2, X } from 'lucide-vue-next'

definePageMeta({ title: 'Developer Cleanup', layout: 'dashboard' })

interface Artifact { path: string, size: string, bytes: number, category: string }
interface Group { category: string, bytes: number, items: Artifact[] }

type State = 'scanning' | 'ready' | 'confirm' | 'running' | 'password' | 'done' | 'error'

const state = ref<State>('scanning')
const items = ref<Artifact[]>([])
const warnings = ref<string[]>([])
const totalBytes = ref(0)
const openGroups = ref<string[]>([])
const cliLine = ref('')
const errorText = ref('')
const password = ref('')
const terminal = useCliTerminal()
let mole: any

const groups = computed<Group[]>(() => {
  const byCategory = new Map<string, Group>()
  for (const item of items.value) {
    const group = byCategory.get(item.category) ?? { category: item.category, bytes: 0, items: [] }
    group.bytes += item.bytes
    group.items.push(item)
    byCategory.set(item.category, group)
  }
  return [...byCategory.values()].sort((a, b) => b.bytes - a.bytes)
})
const isBusy = computed(() => state.value === 'running' || state.value === 'password')

onMounted(() => {
  mole = (window as any).mole
  mole.onPurgeScanStatus((status: { line: string }) => { cliLine.value = status.line })
  mole.onPurgeLog((text: string) => terminal.append(text))
  mole.onPurgeStatus((status: { line: string }) => { cliLine.value = status.line })
  mole.onPurgePassword(() => {
    state.value = 'password'
    nextTick(() => document.querySelector<HTMLInputElement>('input[type="password"]')?.focus())
  })
  mole.onPurgeEnd((result: { success: boolean, error?: string }) => {
    errorText.value = result.success ? '' : friendlyError(result.error)
    state.value = 'done'
  })
  scan()
})

onUnmounted(() => {
  if (state.value === 'scanning') mole?.cancelScan?.()
})

function friendlyError(message?: string) {
  if (message?.includes('mole_not_found')) return 'Mole is required for this feature.'
  if (message?.includes('operation_in_progress')) return 'Another Mole operation is still running.'
  return message || 'Developer cleanup did not finish successfully.'
}

async function scan() {
  state.value = 'scanning'
  errorText.value = ''
  cliLine.value = ''
  try {
    const preview = await mole.purgePreview()
    items.value = preview.items
    warnings.value = preview.warnings
    totalBytes.value = preview.totalBytes
    openGroups.value = []
    state.value = 'ready'
  } catch (error: any) {
    errorText.value = friendlyError(error?.message)
    state.value = 'error'
  }
}

function toggleGroup(category: string) {
  openGroups.value = openGroups.value.includes(category)
    ? openGroups.value.filter(name => name !== category)
    : [...openGroups.value, category]
}

function startClean() {
  terminal.reset()
  errorText.value = ''
  cliLine.value = ''
  state.value = 'running'
  mole.purgeRun()
}

function submitPassword() {
  if (!password.value) return
  mole.sendPassword(password.value)
  password.value = ''
  state.value = 'running'
}

function cancel() {
  mole.cancel()
  errorText.value = 'Cleanup canceled.'
  state.value = 'done'
}
</script>

<template>
  <div class="mx-auto w-full max-w-[1000px] px-6 py-8">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Developer Cleanup</h1>
        <p class="mt-1 text-sm text-muted-foreground">Old build artifacts from your projects — node_modules, build output, caches.</p>
      </div>
      <div class="flex gap-2">
        <Button v-if="state === 'ready' || state === 'done' || state === 'error'" variant="outline" size="sm" @click="scan"><RefreshCw class="h-4 w-4" /> Scan again</Button>
        <Button v-if="state === 'ready' && items.length" variant="destructive" @click="state = 'confirm'"><Trash2 class="h-4 w-4" /> Clean all — {{ formatBytes(totalBytes) }}</Button>
        <Button v-else-if="isBusy" variant="outline" @click="cancel"><X class="h-4 w-4" /> Cancel</Button>
      </div>
    </div>

    <div v-if="state === 'scanning'" class="space-y-3 rounded-xl border bg-card p-6">
      <div class="flex items-center gap-3 text-sm font-medium"><Loader2 class="h-5 w-5 animate-spin" /> Scanning your project folders…</div>
      <div class="h-2 overflow-hidden rounded-full bg-muted"><div class="h-full w-1/3 animate-pulse rounded-full bg-primary" /></div>
      <p class="text-xs text-muted-foreground">Only artifacts that can be rebuilt (like node_modules) are listed. Your source code is never touched.</p>
      <p v-if="cliLine" class="rounded bg-muted px-3 py-2 font-mono text-xs break-all">{{ cliLine }}</p>
    </div>

    <div v-else-if="state === 'error'" class="rounded-xl border bg-card p-6">
      <p class="text-sm text-destructive">{{ errorText }}</p>
      <Button class="mt-4" variant="outline" size="sm" @click="scan"><RefreshCw class="h-4 w-4" /> Try again</Button>
    </div>

    <template v-else-if="state === 'ready'">
      <div class="mb-5 rounded-xl border bg-card p-5">
        <div class="flex items-center gap-3"><Code2 class="h-6 w-6 text-primary" /><div><div class="text-2xl font-bold">{{ formatBytes(totalBytes) }}</div><div class="text-sm text-muted-foreground">reclaimable across {{ items.length }} artifact{{ items.length === 1 ? '' : 's' }}</div></div></div>
        <div v-if="warnings.length" class="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <p v-for="warning in warnings" :key="warning">{{ warning }}</p>
        </div>
      </div>

      <div v-if="!items.length" class="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No reclaimable project artifacts found. Nice and tidy.</div>
      <div v-else class="space-y-3">
        <div v-for="group in groups" :key="group.category" class="overflow-hidden rounded-xl border bg-card">
          <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50" @click="toggleGroup(group.category)">
            <component :is="openGroups.includes(group.category) ? ChevronDown : ChevronRight" class="h-4 w-4 shrink-0 text-muted-foreground" />
            <span class="flex-1 font-semibold">{{ group.category }}</span>
            <span class="text-sm text-muted-foreground">{{ group.items.length }} item{{ group.items.length === 1 ? '' : 's' }}</span>
            <span class="w-24 text-right text-sm font-semibold">{{ formatBytes(group.bytes) }}</span>
          </button>
          <div v-if="openGroups.includes(group.category)" class="border-t">
            <div v-for="item in group.items" :key="item.path" class="flex items-center gap-3 border-b px-4 py-2 text-sm last:border-b-0">
              <span class="min-w-0 flex-1 truncate text-muted-foreground" :title="item.path">{{ item.path }}</span>
              <span class="shrink-0">{{ item.size }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else-if="state === 'confirm'" class="max-w-xl rounded-xl border bg-card p-5 space-y-4">
      <div class="flex gap-3">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <h2 class="font-semibold">Clean {{ items.length }} project artifact{{ items.length === 1 ? '' : 's' }} — {{ formatBytes(totalBytes) }}?</h2>
          <p class="mt-1 text-sm text-muted-foreground">Everything listed in the preview will be removed. These files can be rebuilt (for example with <code>npm install</code> or your next build), but rebuilding takes time.</p>
        </div>
      </div>
      <ul class="max-h-48 space-y-1 overflow-auto rounded-lg bg-muted p-3 text-xs">
        <li v-for="item in items.slice(0, 100)" :key="item.path" class="truncate">{{ item.path }} — {{ item.size }}</li>
        <li v-if="items.length > 100" class="text-muted-foreground">…and {{ items.length - 100 }} more</li>
      </ul>
      <div class="flex gap-2">
        <Button variant="outline" @click="state = 'ready'">Back</Button>
        <Button variant="destructive" @click="startClean">Clean developer files</Button>
      </div>
    </div>

    <div v-else-if="state === 'password'" class="max-w-sm space-y-3 rounded-xl border bg-card p-5">
      <h2 class="font-semibold">Administrator password required</h2>
      <Input v-model="password" type="password" placeholder="Password" @keyup.enter="submitPassword" />
      <Button @click="submitPassword">Continue</Button>
    </div>

    <div v-else class="space-y-4 rounded-xl border bg-card p-5">
      <div class="flex items-center gap-2 font-medium">
        <Loader2 v-if="isBusy" class="h-4 w-4 animate-spin" />
        <Check v-else-if="state === 'done' && !errorText" class="h-4 w-4 text-green-600" />
        <AlertTriangle v-else class="h-4 w-4 text-destructive" />
        {{ isBusy ? 'Cleaning developer files…' : errorText || 'Developer cleanup complete.' }}
      </div>
      <p v-if="isBusy && cliLine" class="rounded bg-muted px-3 py-2 font-mono text-xs break-all">{{ cliLine }}</p>
      <div v-if="errorText && state === 'done'" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{{ errorText }}</div>
      <pre v-if="terminal.text.value" :ref="terminal.box" class="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{{ terminal.text.value }}</pre>
      <Button v-if="state === 'done'" variant="outline" size="sm" @click="scan"><RefreshCw class="h-4 w-4" /> Scan again</Button>
    </div>
  </div>
</template>
