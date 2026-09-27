<script setup lang="ts">
import { AlertTriangle, Check, Loader2, RefreshCw, Search, Trash2, X } from 'lucide-vue-next'

definePageMeta({
  title: 'Uninstall apps',
  layout: 'dashboard',
})

interface App {
  name: string
  uninstall_name: string
  bundle_id: string
  path: string
  size: string
}

type State = 'scanning' | 'ready' | 'confirm' | 'running' | 'password' | 'done' | 'error'

const state = ref<State>('scanning')
const apps = ref<App[]>([])
const selected = ref<string[]>([])
const query = ref('')
const terminal = useCliTerminal()
const password = ref('')
const errorText = ref('')
const startedAt = ref(0)
const elapsed = ref(0)
const progressText = ref('')
const cliLine = ref('')
let mole: any
let clock: ReturnType<typeof setInterval> | null = null

const visibleApps = computed(() => {
  const term = query.value.trim().toLowerCase()
  if (!term) return apps.value
  return apps.value.filter(app => `${app.name} ${app.bundle_id} ${app.path}`.toLowerCase().includes(term))
})
const selectedApps = computed(() => apps.value.filter(app => selected.value.includes(app.uninstall_name)))
const isBusy = computed(() => state.value === 'running' || state.value === 'password')

onMounted(() => {
  mole = (window as any).mole
  mole.onUninstallScanStatus((status: { line: string }) => { cliLine.value = status.line })
  mole.onUninstallLog((text: string) => terminal.append(text))
  mole.onUninstallStatus((status: { line: string }) => { cliLine.value = status.line })
  mole.onUninstallPassword(() => {
    state.value = 'password'
    nextTick(() => document.querySelector<HTMLInputElement>('input[type="password"]')?.focus())
  })
  mole.onUninstallEnd((result: { success: boolean; error?: string }) => {
    stopClock()
    errorText.value = result.success ? '' : errorMessage(result.error)
    progressText.value = result.success ? 'Selected apps processed.' : 'Uninstall failed.'
    state.value = 'done'
    if (result.success) scanApps()
  })
  scanApps()
})

onUnmounted(stopClock)

function errorMessage(error?: string) {
  if (error === 'mole_not_found') return 'Mole is not installed or could not be found.'
  if (error === 'operation_in_progress') return 'Another Mole operation is still running.'
  if (error === 'no_apps_selected') return 'Choose at least one app.'
  return error || 'App scan or uninstall did not finish successfully.'
}

function startClock(message: string) {
  stopClock()
  startedAt.value = Date.now()
  elapsed.value = 0
  progressText.value = message
  clock = setInterval(() => { elapsed.value = Math.floor((Date.now() - startedAt.value) / 1000) }, 1000)
}

function stopClock() {
  if (clock) clearInterval(clock)
  clock = null
}

async function scanApps() {
  state.value = 'scanning'
  errorText.value = ''
  startClock('Scanning Applications folders…')
  cliLine.value = ''
  selected.value = []
  try {
    apps.value = await mole.listUninstallApps()
    progressText.value = `${apps.value.length} apps found.`
    state.value = 'ready'
  } catch (error: any) {
    errorText.value = errorMessage(error?.message)
    progressText.value = 'Scan failed.'
    state.value = 'error'
  } finally {
    stopClock()
  }
}

function toggleApp(app: App) {
  selected.value = selected.value.includes(app.uninstall_name)
    ? selected.value.filter(name => name !== app.uninstall_name)
    : [...selected.value, app.uninstall_name]
}

function openConfirmation() {
  if (selected.value.length) state.value = 'confirm'
}

function confirmUninstall() {
  terminal.reset()
  errorText.value = ''
  cliLine.value = ''
  startClock(`Preparing ${selected.value.length} selected app${selected.value.length === 1 ? '' : 's'}…`)
  state.value = 'running'
  try {
    // Plain copy: a Vue reactive proxy cannot cross the IPC boundary
    // (structured clone rejects proxies).
    mole.uninstall([...selected.value])
  } catch (error: any) {
    stopClock()
    errorText.value = error?.message || 'Failed to start uninstall.'
    progressText.value = 'Uninstall failed to start.'
    state.value = 'error'
  }
}

function submitPassword() {
  if (!password.value) return
  mole.sendPassword(password.value)
  password.value = ''
  state.value = 'running'
}

function cancel() {
  mole.cancel()
  stopClock()
  progressText.value = 'Uninstall canceled.'
  errorText.value = 'Uninstall canceled.'
  state.value = 'done'
}
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] px-6 py-8">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Uninstall apps</h1>
        <p class="mt-1 text-sm text-muted-foreground">Select apps to remove. Mole moves removed files to Trash.</p>
      </div>
      <div class="flex gap-2">
        <Button v-if="state === 'ready' || state === 'done' || state === 'error'" variant="outline" size="sm" @click="scanApps">
          <RefreshCw class="h-4 w-4" /> Scan again
        </Button>
        <Button v-if="state === 'ready'" variant="destructive" :disabled="!selected.length" @click="openConfirmation">
          <Trash2 class="h-4 w-4" /> Uninstall {{ selected.length || '' }} app{{ selected.length === 1 ? '' : 's' }}
        </Button>
        <Button v-else-if="isBusy" variant="outline" @click="cancel">
          <X class="h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>

    <div v-if="state === 'scanning'" class="space-y-3 rounded-xl border bg-card p-6">
      <div class="flex items-center gap-3 text-sm font-medium"><Loader2 class="h-5 w-5 animate-spin" /> {{ progressText }}</div>
      <div class="h-2 overflow-hidden rounded-full bg-muted"><div class="h-full w-1/3 animate-pulse rounded-full bg-primary" /></div>
      <p class="text-xs text-muted-foreground">{{ elapsed }}s elapsed. Large Applications folders can take longer.</p>
      <p v-if="cliLine" class="rounded bg-muted px-3 py-2 font-mono text-xs break-all">CLI: {{ cliLine }}</p>
    </div>

    <div v-else-if="state === 'ready'" class="space-y-5">
      <div class="relative max-w-md">
        <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="query" class="pl-9" placeholder="Search installed apps" />
      </div>
      <p class="text-sm text-muted-foreground">{{ apps.length }} apps found · {{ selected.length }} selected</p>
      <div v-if="visibleApps.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="app in visibleApps"
          :key="app.path"
          type="button"
          class="rounded-xl border bg-card p-4 text-left transition hover:border-primary/50"
          :class="selected.includes(app.uninstall_name) ? 'border-primary ring-1 ring-primary' : ''"
          @click="toggleApp(app)"
        >
          <div class="flex items-start gap-3">
            <input class="mt-1 h-4 w-4 accent-primary" type="checkbox" :checked="selected.includes(app.uninstall_name)" tabindex="-1" />
            <div class="min-w-0 flex-1">
              <div class="truncate font-semibold">{{ app.name }}</div>
              <div class="mt-1 text-xs text-muted-foreground">{{ app.size === '--' ? 'Size unavailable' : app.size }}</div>
              <div class="mt-2 truncate text-xs text-muted-foreground" :title="app.path">{{ app.path }}</div>
            </div>
          </div>
        </button>
      </div>
      <div v-else class="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No apps match this search.</div>
    </div>

    <div v-else-if="state === 'confirm'" class="max-w-lg rounded-xl border bg-card p-5 space-y-4">
      <div class="flex gap-3">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <h2 class="font-semibold">Uninstall {{ selectedApps.length }} selected app{{ selectedApps.length === 1 ? '' : 's' }}?</h2>
          <p class="mt-1 text-sm text-muted-foreground">Files move to Trash. Review selected apps before continuing.</p>
        </div>
      </div>
      <ul class="max-h-48 space-y-1 overflow-auto rounded-lg bg-muted p-3 text-sm">
        <li v-for="app in selectedApps" :key="app.path">{{ app.name }}</li>
      </ul>
      <div class="flex gap-2">
        <Button variant="outline" @click="state = 'ready'">Back</Button>
        <Button variant="destructive" @click="confirmUninstall">Uninstall apps</Button>
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
        {{ isBusy ? progressText : errorText || progressText || 'Uninstall complete.' }}
      </div>
      <template v-if="isBusy"><div class="h-2 overflow-hidden rounded-full bg-muted"><div class="h-full w-1/3 animate-pulse rounded-full bg-primary" /></div><p class="text-xs text-muted-foreground">{{ elapsed }}s elapsed · {{ selected.length }} app{{ selected.length === 1 ? '' : 's' }} selected</p><p v-if="cliLine" class="rounded bg-muted px-3 py-2 font-mono text-xs break-all">CLI: {{ cliLine }}</p></template>
      <div v-if="errorText" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{{ errorText }}</div>
      <pre v-if="terminal.text.value" :ref="terminal.box" class="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{{ terminal.text.value }}</pre>
    </div>
  </div>
</template>
