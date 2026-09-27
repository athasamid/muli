<script setup lang="ts">
import {
  Check, Circle, Cpu, HardDrive, Loader2, Lock,
  MemoryStick, Sparkles, Timer, X,
} from 'lucide-vue-next'

definePageMeta({
  title: 'Overview',
  layout: 'dashboard',
})

interface CleanItem {
  label: string
  size?: string | null
  status: 'cleaned' | 'skipped'
}

interface CleanGroup {
  title: string
  items: CleanItem[]
}

type State = 'idle' | 'cleaning' | 'confirm' | 'password' | 'done'

const state = ref<State>('idle')
const isDryRun = ref(false)

const groups = ref<CleanGroup[]>([])
const summary = ref<string[]>([])
const statusText = ref('')
const errorText = ref('')

const password = ref('')
const passwordAttempt = ref(1)
const passwordError = ref('')

const stats = ref<any>(null)
const startedAt = ref(0)
const elapsed = ref(0)

const listEl = ref<HTMLElement | null>(null)

let mole: any
let statsTimer: ReturnType<typeof setInterval> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null

// ---------- helpers ----------

const UNITS: Record<string, number> = {
  b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12,
  kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4,
}

function parseSize(s?: string | null): number {
  if (!s) return 0
  const m = s.match(/([\d.]+)\s*(b|kb|mb|gb|tb|kib|mib|gib|tib)/i)
  return m ? parseFloat(m[1]) * (UNITS[m[2].toLowerCase()] ?? 0) : 0
}

function formatBytes(n: number): string {
  if (!n) return '0 B'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB'
  return n + ' B'
}

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})

const displayName = computed(() => {
  const u = stats.value?.username ?? ''
  return u ? u.charAt(0).toUpperCase() + u.slice(1) : 'there'
})

const allItems = computed(() => groups.value.flatMap(g => g.items))
const cleanedItems = computed(() => allItems.value.filter(i => i.status === 'cleaned'))
const detectedBytes = computed(() =>
  cleanedItems.value.reduce((sum, i) => sum + parseSize(i.size), 0)
)

const spaceFreedLine = computed(() => {
  const line = summary.value.find(l => /Space freed/i.test(l))
  const m = line?.match(/Space freed:\s*(.+)/i)
  return m?.[1] ?? (detectedBytes.value ? formatBytes(detectedBytes.value) : null)
})

const currentSection = computed(() => groups.value.at(-1)?.title ?? '')
const isBusy = computed(() => ['cleaning', 'confirm', 'password'].includes(state.value))

const storagePct = computed(() => {
  const d = stats.value?.disk
  return d ? Math.round(((d.total - d.free) / d.total) * 100) : 0
})
const memoryPct = computed(() => {
  const m = stats.value?.memory
  return m ? Math.round((m.used / m.total) * 100) : 0
})
const cpuPct = computed(() =>
  Math.min(Math.round((stats.value?.cpu?.load ?? 0) * 100), 100)
)

// ---------- lifecycle ----------

async function refreshStats() {
  try {
    stats.value = await (window as any).system.stats()
  } catch {
    // stats are decorative — ignore
  }
}

onMounted(() => {
  mole = (window as any).mole

  refreshStats()
  statsTimer = setInterval(refreshStats, 5000)

  mole.onCleanSection((d: { title: string }) => {
    groups.value.push({ title: d.title, items: [] })
  })

  mole.onCleanItem((d: CleanItem) => {
    if (groups.value.length === 0) groups.value.push({ title: 'General', items: [] })
    groups.value.at(-1)!.items.push(d)
    nextTick(() => listEl.value?.scrollTo({ top: listEl.value.scrollHeight }))
  })

  mole.onCleanSummary((d: { raw: string }) => {
    summary.value.push(d.raw)
  })

  mole.onCleanStatus((d: { type: string; text: string }) => {
    statusText.value = d.text
    if (d.type === 'admin_granted' || d.type === 'admin_failed') state.value = 'cleaning'
  })

  mole.onCleanConfirm(() => {
    state.value = 'confirm'
  })

  mole.onCleanPasswordRequest((d: { attempt?: number }) => {
    passwordAttempt.value = d?.attempt ?? 1
    state.value = 'password'
    nextTick(() => document.querySelector<HTMLInputElement>('input[type="password"]')?.focus())
  })

  mole.onCleanPasswordError((d: { text: string }) => {
    passwordError.value = d.text
  })

  mole.onCleanEnd((d: { success: boolean; error?: string }) => {
    if (clockTimer) clearInterval(clockTimer)
    if (!d.success && !errorText.value) {
      errorText.value = d.error === 'mole_not_found'
        ? 'Mole is not installed or could not be found.'
        : 'Cleanup did not finish successfully.'
    }
    state.value = 'done'
    refreshStats()
  })
})

onUnmounted(() => {
  if (statsTimer) clearInterval(statsTimer)
  if (clockTimer) clearInterval(clockTimer)
})

// ---------- actions ----------

function startClean(dryRun = false) {
  groups.value = []
  summary.value = []
  statusText.value = ''
  errorText.value = ''
  passwordError.value = ''
  passwordAttempt.value = 1
  isDryRun.value = dryRun
  startedAt.value = Date.now()
  elapsed.value = 0
  clockTimer = setInterval(() => {
    elapsed.value = Math.round((Date.now() - startedAt.value) / 1000)
  }, 1000)
  state.value = 'cleaning'
  mole.clean({ dryRun })
}

function confirmSystemClean() {
  state.value = 'cleaning'
  mole.sendEnter()
}

function skipSystemClean() {
  state.value = 'cleaning'
  mole.sendSkip()
}

function submitPassword() {
  if (!password.value) return
  passwordError.value = ''
  mole.sendPassword(password.value)
  password.value = ''
  state.value = 'cleaning'
}

function cancelClean() {
  mole.cancel()
  if (clockTimer) clearInterval(clockTimer)
  errorText.value = 'Cleanup canceled.'
  state.value = 'done'
}

function reset() {
  state.value = 'idle'
}
</script>

<template>
  <div class="mx-auto w-full max-w-[960px] px-6 py-8">

    <!-- HEADER -->
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-[24px] font-bold tracking-tight">
          {{ greeting }}, {{ displayName }}
        </h1>
        <p class="mt-0.5 text-[13px] text-muted-foreground">
          {{ stats?.hostname ?? 'Mac' }}
          <template v-if="stats?.macosVersion"> · macOS {{ stats.macosVersion }}</template>
          <template v-if="stats?.arch === 'arm64'"> · Apple Silicon</template>
        </p>
      </div>
      <Button v-if="state === 'idle'" @click="startClean(false)">
        <Sparkles class="h-4 w-4" /> Clean Mac
      </Button>
      <Button v-else-if="isBusy" variant="outline" @click="cancelClean">
        <X class="h-4 w-4" /> Cancel
      </Button>
    </div>

    <!-- STAT CARDS -->
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="rounded-xl border bg-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Storage</span>
          <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d8e2ff] dark:bg-[#004493]">
            <HardDrive class="h-3.5 w-3.5 text-[#0058bc] dark:text-[#adc6ff]" />
          </span>
        </div>
        <p class="text-[22px] font-bold leading-none">
          {{ stats?.disk ? formatBytes(stats.disk.free) : '—' }}
          <span class="text-[12px] font-medium text-muted-foreground">free</span>
        </p>
        <div class="mt-3 h-1 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full bg-[#0070eb]" :style="{ width: storagePct + '%' }" />
        </div>
        <p class="mt-1.5 text-[11px] text-muted-foreground">
          {{ storagePct }}% of {{ stats?.disk ? formatBytes(stats.disk.total) : '—' }} used
        </p>
      </div>

      <div class="rounded-xl border bg-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Memory</span>
          <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#6ffb85]/40 dark:bg-[#00531c]">
            <MemoryStick class="h-3.5 w-3.5 text-[#006e28] dark:text-[#6ffb85]" />
          </span>
        </div>
        <p class="text-[22px] font-bold leading-none">
          {{ stats?.memory ? formatBytes(stats.memory.used) : '—' }}
          <span class="text-[12px] font-medium text-muted-foreground">
            of {{ stats?.memory ? formatBytes(stats.memory.total) : '—' }}
          </span>
        </p>
        <div class="mt-3 h-1 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full bg-[#006e28]" :style="{ width: memoryPct + '%' }" />
        </div>
        <p class="mt-1.5 text-[11px] text-muted-foreground">{{ memoryPct }}% in use</p>
      </div>

      <div class="rounded-xl border bg-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">CPU Load</span>
          <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffdcbf] dark:bg-[#6a3b00]">
            <Cpu class="h-3.5 w-3.5 text-[#894d00] dark:text-[#ffb874]" />
          </span>
        </div>
        <p class="text-[22px] font-bold leading-none">
          {{ cpuPct }}<span class="text-[14px] font-semibold">%</span>
        </p>
        <div class="mt-3 h-1 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full bg-[#ac6300]" :style="{ width: cpuPct + '%' }" />
        </div>
        <p class="mt-1.5 text-[11px] text-muted-foreground">
          {{ stats?.cpu?.cores ?? '—' }} cores
        </p>
      </div>
    </div>

    <!-- IDLE: cleanup banner -->
    <div
      v-if="state === 'idle'"
      class="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center"
    >
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d8e2ff] dark:bg-[#004493]">
        <Sparkles class="h-5 w-5 text-[#0058bc] dark:text-[#adc6ff]" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-[14px] font-semibold">
          Ready for a cleanup?
          <span class="ml-1 rounded-full bg-[#6ffb85]/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#00531c] dark:bg-[#00531c] dark:text-[#6ffb85]">
            Recommended
          </span>
        </p>
        <p class="mt-0.5 text-[13px] text-muted-foreground">
          Mole removes app caches, logs, temporary files and other junk —
          safely, with personal documents untouched.
        </p>
      </div>
      <div class="flex shrink-0 gap-2">
        <Button variant="outline" @click="startClean(true)">Preview</Button>
        <Button @click="startClean(false)">Clean Mac</Button>
      </div>
    </div>

    <!-- SCAN / RESULTS AREA -->
    <template v-if="state !== 'idle'">
      <!-- Scan stat row -->
      <div class="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div class="rounded-xl border bg-card p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {{ isDryRun ? 'Reclaimable' : 'Detected size' }}
          </p>
          <p class="mt-1 text-[20px] font-bold leading-none text-[#0058bc] dark:text-[#adc6ff]">
            {{ formatBytes(detectedBytes) }}
          </p>
        </div>
        <div class="rounded-xl border bg-card p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Items found</p>
          <p class="mt-1 text-[20px] font-bold leading-none">{{ allItems.length }}</p>
        </div>
        <div class="rounded-xl border bg-card p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Duration</p>
          <p class="mt-1 flex items-baseline gap-1 text-[20px] font-bold leading-none">
            {{ elapsed }}<span class="text-[12px] font-medium text-muted-foreground">sec</span>
          </p>
        </div>
        <div class="rounded-xl border bg-card p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
          <p class="mt-1 flex items-center gap-1.5 text-[13px] font-semibold leading-none">
            <template v-if="state === 'done' && !errorText">
              <Check class="h-4 w-4 text-[#006e28]" /> Complete
            </template>
            <template v-else-if="state === 'done'">
              <X class="h-4 w-4 text-[#ba1a1a]" /> Stopped
            </template>
            <template v-else>
              <Loader2 class="h-4 w-4 animate-spin text-[#0070eb]" />
              {{ isDryRun ? 'Scanning' : 'Cleaning' }}
            </template>
          </p>
        </div>
      </div>

      <!-- Grouped results -->
      <div class="overflow-hidden rounded-xl border bg-card">
        <div class="flex items-center justify-between border-b px-5 py-3">
          <p class="text-[13px] font-semibold">
            {{ isDryRun ? 'Detected file groups' : 'Cleanup progress' }}
          </p>
          <p v-if="isBusy && currentSection" class="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Loader2 class="h-3 w-3 animate-spin" /> {{ currentSection }}
          </p>
          <p v-else-if="statusText" class="text-[12px] text-muted-foreground">{{ statusText }}</p>
        </div>

        <div ref="listEl" class="max-h-[340px] overflow-y-auto">
          <p v-if="allItems.length === 0" class="px-5 py-8 text-center text-[13px] text-muted-foreground">
            <Loader2 class="mx-auto mb-2 h-4 w-4 animate-spin" />
            Scanning your Mac…
          </p>

          <div v-for="group in groups" :key="group.title">
            <template v-if="group.items.length">
              <div class="sticky top-0 flex items-center justify-between bg-muted/80 px-5 py-1.5 backdrop-blur">
                <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {{ group.title }}
                </span>
                <span class="text-[11px] text-muted-foreground">
                  {{ group.items.length }} items
                </span>
              </div>
              <div
                v-for="(item, i) in group.items"
                :key="i"
                class="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-2 last:border-0"
              >
                <span class="flex min-w-0 items-center gap-2 text-[13px]">
                  <Check v-if="item.status === 'cleaned'" class="h-3.5 w-3.5 shrink-0 text-[#006e28]" />
                  <Circle v-else class="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span class="truncate" :class="item.status === 'skipped' ? 'text-muted-foreground' : ''">
                    {{ item.label }}
                  </span>
                </span>
                <span v-if="item.size" class="shrink-0 font-mono text-[12px] text-muted-foreground">
                  {{ item.size }}
                </span>
              </div>
            </template>
          </div>
        </div>

        <!-- Footer action bar -->
        <div
          v-if="state === 'done'"
          class="flex items-center justify-between border-t bg-muted/40 px-5 py-3.5"
        >
          <p class="text-[13px]" :class="errorText ? 'text-[#ba1a1a]' : 'text-muted-foreground'">
            <template v-if="errorText">{{ errorText }}</template>
            <template v-else-if="isDryRun">
              {{ cleanedItems.length }} items · {{ formatBytes(detectedBytes) }} reclaimable
              <span class="text-[11px]">(nothing was deleted)</span>
            </template>
            <template v-else>
              <span class="font-semibold text-[#006e28]">✓ Cleanup complete</span>
              <template v-if="spaceFreedLine"> · Space freed: <span class="font-semibold">{{ spaceFreedLine }}</span></template>
            </template>
          </p>
          <div class="flex gap-2">
            <Button variant="outline" size="sm" @click="reset">Done</Button>
            <Button v-if="isDryRun && !errorText" size="sm" @click="startClean(false)">
              Clean {{ formatBytes(detectedBytes) }}
            </Button>
          </div>
        </div>
      </div>
    </template>

    <!-- CONFIRM MODAL -->
    <div v-if="state === 'confirm'" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div class="w-full max-w-[420px] rounded-2xl border border-black/5 bg-card p-6 shadow-xl">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#d8e2ff] dark:bg-[#004493]">
          <Lock class="h-6 w-6 text-[#0058bc] dark:text-[#adc6ff]" />
        </div>
        <h2 class="text-[17px] font-semibold tracking-tight">Deep clean system files?</h2>
        <p class="mt-1 mb-5 text-[13px] leading-relaxed text-muted-foreground">
          Cleaning system caches frees the most space, but needs your Mac
          login password. You can also skip it and clean personal files only.
        </p>
        <div class="flex flex-col gap-2">
          <Button class="w-full" @click="confirmSystemClean">Yes, deep clean (recommended)</Button>
          <Button variant="outline" class="w-full" @click="skipSystemClean">Skip system files</Button>
        </div>
      </div>
    </div>

    <!-- PASSWORD MODAL -->
    <div v-if="state === 'password'" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div class="w-full max-w-[420px] rounded-2xl border border-black/5 bg-card p-6 shadow-xl">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#d8e2ff] dark:bg-[#004493]">
          <Lock class="h-6 w-6 text-[#0058bc] dark:text-[#adc6ff]" />
        </div>
        <h2 class="text-[17px] font-semibold tracking-tight">Enter your Mac password</h2>
        <p class="mt-1 mb-4 text-[13px] text-muted-foreground">
          Your password goes directly to macOS and is never stored.
          <span v-if="passwordAttempt > 1" class="mt-1 block font-medium text-[#ba1a1a]">
            Wrong password, try again ({{ passwordAttempt }}/3).
          </span>
        </p>
        <form class="flex flex-col gap-3" @submit.prevent="submitPassword">
          <Input
            v-model="password"
            type="password"
            placeholder="Mac login password"
            class="w-full"
            autofocus
          />
          <p v-if="passwordError" class="text-[12px] text-[#ba1a1a]">{{ passwordError }}</p>
          <div class="flex gap-2">
            <Button variant="outline" type="button" class="flex-1" @click="cancelClean">Cancel</Button>
            <Button type="submit" class="flex-1" :disabled="!password">Continue</Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
