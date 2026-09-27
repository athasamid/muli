<script setup lang="ts">
import { Check, Loader2, Sparkles, X } from 'lucide-vue-next'

definePageMeta({
  title: 'Optimize',
  layout: 'dashboard',
})

type State = 'idle' | 'running' | 'password' | 'done'

const state = ref<State>('idle')
const terminal = useCliTerminal()
const password = ref('')
const errorText = ref('')
let mole: any

const isBusy = computed(() => state.value === 'running' || state.value === 'password')

onMounted(() => {
  mole = (window as any).mole
  mole.onOptimizeLog((text: string) => terminal.append(text))
  mole.onOptimizePassword(() => {
    state.value = 'password'
    nextTick(() => document.querySelector<HTMLInputElement>('input[type="password"]')?.focus())
  })
  mole.onOptimizeEnd((result: { success: boolean; error?: string }) => {
    errorText.value = result.success ? '' : result.error === 'mole_not_found'
      ? 'Mole is not installed or could not be found.'
      : 'Optimization did not finish successfully.'
    state.value = 'done'
  })
})

function startOptimize() {
  terminal.reset()
  errorText.value = ''
  state.value = 'running'
  mole.optimize()
}

function submitPassword() {
  if (!password.value) return
  mole.sendPassword(password.value)
  password.value = ''
  state.value = 'running'
}

function cancel() {
  mole.cancel()
  errorText.value = 'Optimization canceled.'
  state.value = 'done'
}
</script>

<template>
  <div class="mx-auto w-full max-w-[760px] px-6 py-8">
    <div class="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Optimize Mac</h1>
        <p class="mt-1 text-sm text-muted-foreground">Refresh caches and services with Mole.</p>
      </div>
      <Button v-if="state === 'idle' || state === 'done'" @click="startOptimize">
        <Sparkles class="h-4 w-4" /> Optimize
      </Button>
      <Button v-else variant="outline" @click="cancel">
        <X class="h-4 w-4" /> Cancel
      </Button>
    </div>

    <div class="rounded-xl border bg-card p-5">
      <div v-if="state === 'idle'" class="space-y-2">
        <h2 class="font-semibold">Ready to optimize</h2>
        <p class="text-sm text-muted-foreground">Mole refreshes selected system caches and services.</p>
      </div>
      <div v-else-if="state === 'password'" class="max-w-sm space-y-3">
        <h2 class="font-semibold">Administrator password required</h2>
        <Input v-model="password" type="password" placeholder="Password" @keyup.enter="submitPassword" />
        <Button @click="submitPassword">Continue</Button>
      </div>
      <div v-else class="space-y-4">
        <div class="flex items-center gap-2 font-medium">
          <Loader2 v-if="isBusy" class="h-4 w-4 animate-spin" />
          <Check v-else class="h-4 w-4 text-green-600" />
          {{ isBusy ? 'Optimizing…' : errorText || 'Optimization complete.' }}
        </div>
        <pre v-if="terminal.text.value" :ref="terminal.box" class="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{{ terminal.text.value }}</pre>
      </div>
    </div>
  </div>
</template>
