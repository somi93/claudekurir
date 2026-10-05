// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    head: {
      // Jezik stranice za čitače ekrana (<html lang> je ranije bio prazan).
      htmlAttrs: { lang: 'sr' },
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover'
    }
  },

  // Auto-import svih komponenti po golom imenu (bez prefiksa foldera), da se
  // globalne komponente (GlobalTextField, GlobalSelect, ...) koriste kao
  // <GlobalTextField> bez import linije u svakom fajlu.
  components: [{ path: '~/components', pathPrefix: false }],

  runtimeConfig: {
    public: {
      // NUXT_PUBLIC_GPS_API_BASE env var automatski preglašava ovu vrijednost
      // (Nuxt konvencija za runtimeConfig.public.*), pa ne treba ručno čitati
      // process.env ovdje. Dev i prod su ionako gađali isti API.
      // Firebase Web push config je build-time konstanta -> app/app.config.ts.
      gpsApiBase: 'https://api.kurir.ordera.app/api',

      // Laravel Reverb (WebSocket) - kanal za "offer.round.changed" evente na
      // dodeli narudžbi (vidi plugins/echo.client.ts + composables/useOrderOfferRound.ts).
      // Vrijednosti iz backend snippet-a (10.09.2026). Svaka se preglašava
      // NUXT_PUBLIC_REVERB_* env varom. authEndpoint je pretpostavka - Bearer
      // /broadcasting/auth na API hostu; potvrda je otvoreno pitanje kod backenda.
      reverb: {
        key: 'uqrwfjx8bqxf0qtfhmrt',
        wsHost: 'ws.kurir.ordera.app',
        wsPort: 443,
        wssPort: 443,
        forceTLS: true,
        authEndpoint: 'https://api.kurir.ordera.app/broadcasting/auth'
      }
    }
  },

  modules: [
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxtjs/device',
    '@nuxtjs/i18n',
    '@nuxtjs/leaflet',
    '@nuxtjs/robots',
    '@pinia/nuxt',
    '@vue-api/nuxt',
    'vuetify-nuxt-module'
  ],

  // Aplikacija nema prevode niti i18n rutiranje - modul je tu samo zato što ga
  // vuetify-nuxt-module koristi za lokalizaciju ugrađenih komponenti (npr.
  // dugme za zatvaranje). Bez ovoga nema defaultLocale-a pa i18n baca warning,
  // a Vuetify ne zna koji lokal fajl (sr-Latn) da učita za svoje poruke.
  i18n: {
    locales: [{ code: 'sr-Latn', language: 'sr-Latn', name: 'Srpski' }],
    defaultLocale: 'sr-Latn',
    strategy: 'no_prefix'
  },

  vuetify: {
    vuetifyOptions: {
      theme: {
        defaultTheme: 'delivery',
        themes: {
          delivery: {
            dark: false,
            colors: {
              background: '#f5f6f8',
              surface: '#ffffff',
              primary: '#0b1220',
              'on-primary': '#ffffff',
              secondary: '#2f6fed',
              'on-secondary': '#ffffff',
              accent: '#00b37e',
              'on-accent': '#ffffff',
              brand: '#ffc247',
              'on-brand': '#2a1e00',
              info: '#2f6fed',
              success: '#1e611e',
              warning: '#ff9f1c',
              error: '#ef4444'
            },
            variables: {
              'border-color': '#e7e9ee',
            }
          }
        }
      },
      defaults: {
        VCard: { rounded: 'lg', elevation: 0 },
        VBtn: { rounded: 'pill', style: 'letter-spacing: 0;' },
        VChip: { rounded: 'pill' },
        VTextField: { variant: 'outlined', density: 'comfortable', rounded: 'lg' },
        VSelect: { variant: 'outlined', density: 'comfortable', rounded: 'lg' }
      }
    }
  }
})
