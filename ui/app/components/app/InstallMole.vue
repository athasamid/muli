<script setup lang="ts">
import { Download, Lock, TerminalSquare, BadgeCheck } from 'lucide-vue-next'

const emit = defineEmits(['install'])

const steps = [
  { icon: Download, label: 'Download installer', detail: 'Fetch the official Mole install script' },
  { icon: TerminalSquare, label: 'Install command line tool', detail: 'Set up the mo command on this Mac' },
  { icon: BadgeCheck, label: 'Verify installation', detail: 'Make sure everything works' },
]
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[#faf8fe] dark:bg-[#1a1b1f] p-6">
    <div class="w-full max-w-[440px] rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#2f3034] shadow-xl overflow-hidden">

      <div class="flex items-center justify-between px-6 pt-5">
        <span class="text-[11px] font-semibold uppercase tracking-widest text-[#717786]">
          Component setup
        </span>
        <span class="inline-flex items-center gap-1 rounded-full bg-[#f4f3f8] dark:bg-white/10 px-2.5 py-1 text-[11px] font-medium text-[#414755] dark:text-[#c1c6d7]">
          <Lock class="h-3 w-3" /> 100% Local · Zero Telemetry
        </span>
      </div>

      <div class="px-6 pt-5 pb-2 flex items-start gap-4">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#d8e2ff] dark:bg-[#004493]">
          <TerminalSquare class="h-6 w-6 text-[#0058bc] dark:text-[#adc6ff]" />
        </div>
        <div>
          <h2 class="text-[17px] font-semibold tracking-tight text-[#1a1b1f] dark:text-white">
            Mole CLI is required
          </h2>
          <p class="mt-1 text-[13px] leading-relaxed text-[#414755] dark:text-[#c1c6d7]">
            Deep disk inspection, residual purge, and system cleanup need
            Mole's helper tool. It's free, open-source, and installs in about a minute.
          </p>
        </div>
      </div>

      <div class="mx-6 my-4 rounded-xl border border-black/5 dark:border-white/10 bg-[#f4f3f8] dark:bg-[#1a1b1f]/60 divide-y divide-black/5 dark:divide-white/5">
        <div
          v-for="(step, i) in steps"
          :key="step.label"
          class="flex items-center gap-3 px-4 py-3"
        >
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-white/10 text-[11px] font-semibold text-[#414755] dark:text-[#c1c6d7] border border-black/10 dark:border-white/10">
            {{ i + 1 }}
          </span>
          <div class="min-w-0">
            <p class="text-[13px] font-medium text-[#1a1b1f] dark:text-white">{{ step.label }}</p>
            <p class="text-[12px] text-[#717786]">{{ step.detail }}</p>
          </div>
          <component :is="step.icon" class="ml-auto h-4 w-4 text-[#717786]" />
        </div>
      </div>

      <div class="flex items-center justify-between border-t border-black/5 dark:border-white/10 bg-[#faf8fe] dark:bg-[#1a1b1f]/40 px-6 py-4">
        <span class="text-[11px] text-[#717786]">Sandboxed installation helper</span>
        <Button size="sm" @click="emit('install')">
          Install Mole
        </Button>
      </div>
    </div>
  </div>
</template>
