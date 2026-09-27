<script setup lang="ts">
import { Check, Loader2, ShieldCheck } from 'lucide-vue-next'

// Purely visual — index.vue swaps this out as soon as mole.check() resolves.
const rows = [
  { label: 'macOS environment', status: 'Ready', done: true },
  { label: 'Local storage access', status: 'Authorized', done: true },
  { label: 'Mole CLI binary path', status: 'Checking…', done: false },
]
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[#faf8fe] dark:bg-[#1a1b1f] p-6">
    <div class="w-full max-w-[400px] rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#2f3034] shadow-xl p-8 text-center">
      <div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d8e2ff] dark:bg-[#004493]">
        <ShieldCheck class="h-7 w-7 text-[#0058bc] dark:text-[#adc6ff]" />
      </div>

      <h2 class="text-[17px] font-semibold tracking-tight text-[#1a1b1f] dark:text-white mb-1">
        Checking system requirements…
      </h2>
      <p class="text-[13px] text-[#414755] dark:text-[#c1c6d7] mb-6">
        Verifying Mole CLI availability and environment permissions
      </p>

      <div class="relative h-1 w-full overflow-hidden rounded-full bg-[#e3e2e7] dark:bg-white/10 mb-6">
        <div class="animate-progress absolute h-full w-1/3 rounded-full bg-[#0070eb]" />
      </div>

      <div class="rounded-xl border border-black/5 dark:border-white/10 bg-[#f4f3f8] dark:bg-[#1a1b1f]/60 divide-y divide-black/5 dark:divide-white/5 text-left">
        <div
          v-for="row in rows"
          :key="row.label"
          class="flex items-center justify-between px-4 py-2.5"
        >
          <span class="flex items-center gap-2 text-[13px] text-[#1a1b1f] dark:text-white">
            <Check v-if="row.done" class="h-3.5 w-3.5 text-[#006e28]" />
            <Loader2 v-else class="h-3.5 w-3.5 animate-spin text-[#0070eb]" />
            {{ row.label }}
          </span>
          <span
            class="text-[11px] font-semibold uppercase tracking-wide"
            :class="row.done ? 'text-[#006e28]' : 'text-[#0070eb]'"
          >
            {{ row.status }}
          </span>
        </div>
      </div>

      <p class="mt-6 text-[11px] text-[#717786]">
        Open-source · Runs locally · Data stays on this Mac
      </p>
    </div>
  </div>
</template>

<style scoped>
@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(30%); }
  100% { transform: translateX(350%); }
}
.animate-progress {
  animation: indeterminate 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
</style>
