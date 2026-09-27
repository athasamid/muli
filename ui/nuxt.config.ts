import tailwindcss from '@tailwindcss/vite'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
    viewer: { endpoint: '/_tailwind', exportViewer: true },
  },

  modules: [
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxtjs/tailwindcss',
    'shadcn-nuxt',
  ],
  shadcn: {
    /**
     * Prefix for all the imported component.
     * @default "Ui"
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * Will respect the Nuxt aliases.
     * @link https://nuxt.com/docs/api/nuxt-config#alias
     * @default "@/components/ui"
     */
    componentDir: '@/components/ui'
  },
  ssr: false,
  nitro: {
    preset: 'static'
  }
})