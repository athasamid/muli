<script setup lang="ts">
import { Check, ChevronDown, ChevronRight, Loader2, Lock, TerminalSquare } from 'lucide-vue-next'

const emit = defineEmits(['done'])

type StepStatus = 'pending' | 'running' | 'completed'

const steps = ref<{ label: string; detail: string; status: StepStatus }[]>([
  { label: 'Download installer', detail: 'Fetching the official install script', status: 'running' },
  { label: 'Install command line tool', detail: 'Setting up the mo command', status: 'pending' },
  { label: 'Verify installation', detail: 'Checking the binary works', status: 'pending' },
])

const logs = ref<string[]>([])
const showDetails = ref(false)
const needPassword = ref(false)
const password = ref('')
const terminalEl = ref<HTMLElement | null>(null)

const currentStep = computed(() => steps.value.findIndex(s => s.status === 'running') + 1)

function advanceTo(index: number) {
  steps.value.forEach((s, i) => {
    if (i < index) s.status = 'completed'
    else if (i === index) s.status = 'running'
  })
}

onMounted(() => {
  const mole = (window as any).mole
  mole.install()

  mole.onInstallLog((line: string) => {
    logs.value.push(line)
    // Once the script starts installing (not just downloading), move to step 2
    if (/install|copy|link|extract/i.test(line)) advanceTo(1)
    nextTick(() => {
      terminalEl.value?.scrollTo({ top: terminalEl.value.scrollHeight })
    })
  })

  mole.onInstallPassword(() => {
    needPassword.value = true
  })

  mole.onInstallEnd((res: { success: boolean; path?: string }) => {
    needPassword.value = false
    if (res.success) {
      steps.value.forEach(s => (s.status = 'completed'))
      // Let the completed checkmarks be visible for a beat
      setTimeout(() => emit('done', res), 600)
    } else {
      emit('done', res)
    }
  })
})

function submitPassword() {
  if (!password.value) return
  ;(window as any).mole.sendPassword(password.value)
  password.value = ''
  needPassword.value = false
}

function cancel() {
  ;(window as any).mole.cancel()
  emit('done', { success: false, canceled: true })
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[#faf8fe] dark:bg-[#1a1b1f] p-6">
    <div class="w-full max-w-[480px] rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#2f3034] shadow-xl overflow-hidden">

      <div class="flex items-center justify-between px-6 pt-5">
        <span class="text-[11px] font-semibold uppercase tracking-widest text-[#717786]">
          Component setup
        </span>
        <span class="inline-flex items-center gap-1 rounded-full bg-[#f4f3f8] dark:bg-white/10 px-2.5 py-1 text-[11px] font-medium text-[#414755] dark:text-[#c1c6d7]">
          <Lock class="h-3 w-3" /> 100% Local · Zero Telemetry
        </span>
      </div>

      <div class="px-6 pt-5 pb-2 flex items-start gap-4">
        <div class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#d8e2ff] dark:bg-[#004493]">
          <span class="macos-pulse absolute inset-0 rounded-xl bg-[#0070eb]/20" />
          <TerminalSquare class="h-6 w-6 text-[#0058bc] dark:text-[#adc6ff]" />
        </div>
        <div>
          <h2 class="text-[17px] font-semibold tracking-tight text-[#1a1b1f] dark:text-white">
            Installing Mole…
          </h2>
          <p class="mt-1 text-[13px] text-[#414755] dark:text-[#c1c6d7]">
            Step {{ Math.max(currentStep, 1) }} of {{ steps.length }} — this
            usually takes about a minute.
          </p>
        </div>
      </div>

      <div class="mx-6 my-4 rounded-xl border border-black/5 dark:border-white/10 bg-[#f4f3f8] dark:bg-[#1a1b1f]/60 divide-y divide-black/5 dark:divide-white/5">
        <div
          v-for="(step, i) in steps"
          :key="step.label"
          class="flex items-center gap-3 px-4 py-3"
          :class="step.status === 'pending' ? 'opacity-50' : ''"
        >
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
            :class="{
              'bg-[#6ffb85]/40 text-[#00531c] dark:bg-[#00531c] dark:text-[#6ffb85]': step.status === 'completed',
              'bg-[#d8e2ff] text-[#0058bc] dark:bg-[#004493] dark:text-[#adc6ff]': step.status === 'running',
              'bg-white dark:bg-white/10 text-[#717786] border border-black/10 dark:border-white/10': step.status === 'pending',
            }"
          >
            <Check v-if="step.status === 'completed'" class="h-3.5 w-3.5" />
            <Loader2 v-else-if="step.status === 'running'" class="h-3.5 w-3.5 animate-spin" />
            <template v-else>{{ i + 1 }}</template>
          </span>
          <div class="min-w-0">
            <p class="text-[13px] font-medium text-[#1a1b1f] dark:text-white">{{ step.label }}</p>
            <p class="text-[12px] text-[#717786]">{{ step.detail }}</p>
          </div>
          <span
            v-if="step.status === 'running'"
            class="ml-auto text-[11px] font-semibold uppercase tracking-wide text-[#0070eb]"
          >
            Running
          </span>
          <span
            v-else-if="step.status === 'completed'"
            class="ml-auto text-[11px] font-semibold uppercase tracking-wide text-[#006e28]"
          >
            Done
          </span>
        </div>
      </div>

      <!-- Password request -->
      <div v-if="needPassword" class="mx-6 mb-4 rounded-xl border border-[#0070eb]/30 bg-[#d8e2ff]/40 dark:bg-[#004493]/30 p-4">
        <p class="flex items-center gap-2 text-[13px] font-medium text-[#1a1b1f] dark:text-white mb-1">
          <Lock class="h-3.5 w-3.5 text-[#0058bc] dark:text-[#adc6ff]" />
          Administrator password needed
        </p>
        <p class="text-[12px] text-[#414755] dark:text-[#c1c6d7] mb-3">
          The installer needs your Mac login password. It goes directly to
          macOS and is never stored.
        </p>
        <form class="flex gap-2" @submit.prevent="submitPassword">
          <Input
            v-model="password"
            type="password"
            placeholder="Mac login password"
            class="flex-1 bg-white dark:bg-[#1a1b1f]"
            autofocus
          />
          <Button type="submit" size="sm" :disabled="!password">Continue</Button>
        </form>
      </div>

      <!-- Technical details -->
      <div class="mx-6 mb-4">
        <button
          class="flex items-center gap-1 text-[12px] font-medium text-[#414755] dark:text-[#c1c6d7] hover:text-[#1a1b1f] dark:hover:text-white"
          @click="showDetails = !showDetails"
        >
          <component :is="showDetails ? ChevronDown : ChevronRight" class="h-3.5 w-3.5" />
          {{ showDetails ? 'Hide' : 'Show' }} technical details
        </button>
        <div
          v-if="showDetails"
          class="mt-2 rounded-xl bg-[#16171b] overflow-hidden"
        >
          <div class="flex items-center gap-1.5 px-3 py-2 border-b border-white/5">
            <span class="h-2.5 w-2.5 rounded-full bg-[#FF5F56]" />
            <span class="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
            <span class="h-2.5 w-2.5 rounded-full bg-[#27C93F]" />
            <span class="ml-2 text-[10px] uppercase tracking-wider text-[#7982a0]">terminal output</span>
          </div>
          <pre
            ref="terminalEl"
            class="max-h-40 overflow-y-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-[11px] leading-relaxed text-[#8cd5ff]"
          >{{ logs.join('') || 'Waiting for installer output…' }}</pre>
        </div>
      </div>

      <div class="flex items-center justify-between border-t border-black/5 dark:border-white/10 bg-[#faf8fe] dark:bg-[#1a1b1f]/40 px-6 py-4">
        <span class="text-[11px] text-[#717786]">Sandboxed installation helper</span>
        <Button variant="outline" size="sm" @click="cancel">Cancel</Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulseRing {
  0% { transform: scale(0.9); opacity: 0.8; }
  50% { transform: scale(1.15); opacity: 0.3; }
  100% { transform: scale(0.9); opacity: 0.8; }
}
.macos-pulse {
  animation: pulseRing 1.8s infinite ease-in-out;
}
</style>
