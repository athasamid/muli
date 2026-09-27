<script setup lang="ts">
import { CircleAlert } from 'lucide-vue-next'
import CheckingRequirements from '~/components/app/CheckingRequirements.vue'
import InstallingMole from '~/components/app/InstallingMole.vue'
import InstallMole from '~/components/app/InstallMole.vue'

const state = ref<'checking' | 'not_installed' | 'installing' | 'error'>('checking')
const molePath = ref<string | null>(null)

onMounted(async () => {
  const res = await (window as any).mole.check()

  setTimeout(() => {
    if (res.status === 'ready') {
      molePath.value = res.path
      navigateTo('/dashboard')
    } else if (res.status === 'not_installed') {
      state.value = 'not_installed'
    } else {
      state.value = 'error'
    }
  }, 1000)
})

function onInstallDone(res: { success: boolean; path?: string; canceled?: boolean }) {
  if (res.success) {
    molePath.value = res.path ?? null
    navigateTo('/dashboard')
  } else if (res.canceled) {
    state.value = 'not_installed'
  } else {
    state.value = 'error'
  }
}
</script>

<template>
  <CheckingRequirements v-if="state === 'checking'" />
  <InstallMole
    v-else-if="state === 'not_installed'"
    @install="state = 'installing'"
  />
  <InstallingMole
    v-else-if="state === 'installing'"
    @done="onInstallDone"
  />
  <div
    v-else-if="state === 'error'"
    class="min-h-screen flex items-center justify-center bg-[#faf8fe] dark:bg-[#1a1b1f] p-6"
  >
    <div class="w-full max-w-[400px] rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#2f3034] shadow-xl p-8 text-center">
      <div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ffdad6]">
        <CircleAlert class="h-7 w-7 text-[#ba1a1a]" />
      </div>
      <h2 class="text-[17px] font-semibold tracking-tight text-[#1a1b1f] dark:text-white mb-1">
        Installation didn't finish
      </h2>
      <p class="text-[13px] text-[#414755] dark:text-[#c1c6d7] mb-6">
        Something interrupted the Mole setup. Your Mac wasn't changed —
        you can safely try again.
      </p>
      <Button class="w-full" @click="state = 'installing'">
        Try again
      </Button>
    </div>
  </div>
</template>
