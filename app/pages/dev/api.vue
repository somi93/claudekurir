<template>
  <GlobalPage :max-width="1100">
    <template #header>
      <PageHeader title="Dev · API konzola" back-to="/" back-label="Nazad na početnu">
        <template #actions>
          <v-chip size="small" color="warning" variant="flat">DEV ALAT</v-chip>
        </template>
      </PageHeader>
    </template>

    <PageAlert type="info" class="mb-4">
      Mini-Postman. Radi za dispečera i kurira. Zahtjev ide kroz isti sloj kao
      aplikacija (base URL + <code>Authorization: Bearer</code> se kače automatski).
      Da gađaš tuđe endpointe iz svoje sesije (npr. kurirske dok si dispečer)
      zalijepi drugi token u <b>Token override</b>. Ništa se ne pamti na serveru;
      polja se čuvaju u ovom browseru.
    </PageAlert>

    <div class="dev-grid">
      <!-- LIJEVO: forma -->
      <GlobalCard padding="18px">
        <div class="d-flex ga-2 flex-wrap align-center">
          <GlobalSelect
            v-model="method"
            :items="METHODS"
            label="Metoda"
            hide-details
            density="compact"
            style="max-width: 130px"
          />
          <GlobalTextField
            v-model="path"
            label="Putanja ili pun URL"
            placeholder="/dispatcher/orders/123/offers"
            hide-details
            density="compact"
            class="flex-grow-1"
            style="min-width: 260px"
            @keydown.enter="send"
          />
        </div>

        <div class="hint mt-1">
          {{ resolvedUrl }}
        </div>

        <GlobalTextField
          v-model="tokenOverride"
          label="Token override (prazno = token trenutne sesije)"
          placeholder="Bearer token za drugi nalog…"
          hide-details
          density="compact"
          class="mt-3"
          clearable
        />

        <v-textarea
          v-if="method !== 'GET'"
          v-model="body"
          label="JSON body"
          :error="Boolean(bodyError)"
          :error-messages="bodyError ? [bodyError] : []"
          variant="outlined"
          density="compact"
          rows="8"
          class="mt-3 mono"
          auto-grow
          spellcheck="false"
        />

        <div class="d-flex ga-2 mt-3 flex-wrap">
          <GlobalButtonPrimary :loading="sending" @click="send">Pošalji</GlobalButtonPrimary>
          <v-btn variant="text" size="small" :disabled="!result" @click="copyCurl">
            <v-icon start icon="mdi-console-line" /> Kopiraj kao curl
          </v-btn>
          <v-btn variant="text" size="small" :disabled="!result" @click="copyResponse">
            <v-icon start icon="mdi-content-copy" /> Kopiraj odgovor
          </v-btn>
        </div>

        <!-- Prečice -->
        <div class="mt-5">
          <div class="section-label">Test podaci</div>
          <div class="d-flex ga-2 flex-wrap mt-1">
            <GlobalTextField
              v-model.number="ids.order"
              type="number"
              label="ORDER"
              hide-details
              density="compact"
              style="max-width: 120px"
            />
            <GlobalTextField
              v-model.number="ids.otherOrder"
              type="number"
              label="DRUGA narudžba"
              hide-details
              density="compact"
              style="max-width: 140px"
            />
            <GlobalTextField
              v-model.number="ids.c1"
              type="number"
              label="C1"
              hide-details
              density="compact"
              style="max-width: 110px"
            />
            <GlobalTextField
              v-model.number="ids.c2"
              type="number"
              label="C2"
              hide-details
              density="compact"
              style="max-width: 110px"
            />
          </div>

          <template v-for="group in SHORTCUTS" :key="group.label">
            <div class="section-label mt-4">{{ group.label }}</div>
            <div class="d-flex ga-2 flex-wrap mt-1">
              <v-btn
                v-for="s in group.items"
                :key="s.id"
                size="small"
                variant="tonal"
                @click="applyShortcut(s)"
              >
                {{ s.id }} · {{ s.name }}
              </v-btn>
            </div>
          </template>
        </div>
      </GlobalCard>

      <!-- DESNO: odgovor -->
      <GlobalCard padding="18px">
        <div v-if="!result && !sending" class="hint">Odgovor se prikazuje ovdje.</div>
        <div v-else-if="sending" class="hint">Šaljem…</div>
        <template v-else-if="result">
          <div class="d-flex ga-2 align-center flex-wrap">
            <v-chip :color="statusColor" variant="flat" size="small">
              {{ result.status || "—" }} {{ result.statusText }}
            </v-chip>
            <span class="hint">{{ result.method }} · {{ result.durationMs }} ms</span>
          </div>

          <PageAlert v-if="result.error" type="error" class="mt-3">
            {{ result.error }}
          </PageAlert>

          <div class="section-label mt-3">Body</div>
          <pre class="out mono">{{ result.bodyText }}</pre>

          <details class="mt-2">
            <summary class="hint" style="cursor: pointer">Response headers</summary>
            <pre class="out mono">{{ result.headersText }}</pre>
          </details>
        </template>
      </GlobalCard>
    </div>
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Dev · API konzola" });

import { computed, reactive, ref, watch } from "vue";
import { useRuntimeConfig } from "nuxt/app";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalSelect from "~/components/common/GlobalSelect.vue";
import GlobalTextField from "~/components/common/GlobalTextField.vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import { SESSION_KEYS } from "~/stores/session";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
const METHODS: HttpMethod[] = ["GET", "POST", "PATCH", "PUT", "DELETE"];

const apiBase = useRuntimeConfig().public.gpsApiBase as string;
// api.kurir.ordera.app  (bez /api) - za /broadcasting/auth prečice
const host = apiBase.replace(/\/api\/?$/, "");

const method = ref<HttpMethod>("GET");
const path = ref("/dispatcher/orders/waiting?delivery_company_id=24");
const body = ref("");
const tokenOverride = ref("");
const bodyError = ref("");
const sending = ref(false);

const ids = reactive({
  order: null as number | null,
  otherOrder: null as number | null,
  c1: null as number | null,
  c2: null as number | null,
});

// --- persist (samo ovaj browser) ---
const LS_KEY = "dev-api-console";
const restore = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.method) method.value = s.method;
    if (typeof s.path === "string") path.value = s.path;
    if (typeof s.body === "string") body.value = s.body;
    if (typeof s.tokenOverride === "string") tokenOverride.value = s.tokenOverride;
    if (s.ids) Object.assign(ids, s.ids);
  } catch {
    /* ignore */
  }
};
restore();
watch(
  [method, path, body, tokenOverride, () => ({ ...ids })],
  () => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          method: method.value,
          path: path.value,
          body: body.value,
          tokenOverride: tokenOverride.value,
          ids: { ...ids },
        })
      );
    } catch {
      /* ignore */
    }
  },
  { deep: true }
);

const isAbsolute = (p: string) => /^https?:\/\//i.test(p.trim());
const resolvedUrl = computed(() => {
  const p = path.value.trim();
  if (!p) return "";
  return isAbsolute(p) ? p : apiBase + (p.startsWith("/") ? p : "/" + p);
});

const sessionToken = () => {
  try {
    return localStorage.getItem(SESSION_KEYS.token) ?? "";
  } catch {
    return "";
  }
};
const activeToken = () => tokenOverride.value.trim() || sessionToken();

type ReqResult = {
  method: string;
  status: number;
  statusText: string;
  durationMs: number;
  bodyText: string;
  headersText: string;
  error?: string;
};
const result = ref<ReqResult | null>(null);

const statusColor = computed(() => {
  const s = result.value?.status ?? 0;
  if (result.value?.error) return "error";
  if (s >= 200 && s < 300) return "success";
  if (s >= 400 && s < 500) return "warning";
  if (s >= 500) return "error";
  return "default";
});

const parseBody = (): unknown => {
  bodyError.value = "";
  if (method.value === "GET") return undefined;
  const raw = body.value.trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch (e) {
    bodyError.value = "Neispravan JSON: " + (e as Error).message;
    throw e;
  }
};

const send = async () => {
  let parsed: unknown;
  try {
    parsed = parseBody();
  } catch {
    return;
  }

  const url = resolvedUrl.value;
  if (!url) return;

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = activeToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (parsed !== undefined) headers["Content-Type"] = "application/json";

  sending.value = true;
  result.value = null;
  const t0 = performance.now();

  try {
    let captured: Response | null = null;
    const data = await $fetch(url, {
      method: method.value,
      headers,
      body: parsed as Record<string, unknown> | undefined,
      ignoreResponseError: true,
      onResponse({ response }) {
        captured = response;
      },
    });

    const dur = Math.round(performance.now() - t0);
    const res = captured as Response | null;
    const headerLines: string[] = [];
    if (res) {
      res.headers.forEach((v, k) => headerLines.push(`${k}: ${v}`));
    }
    result.value = {
      method: `${method.value} ${url}`,
      status: res?.status ?? 0,
      statusText: res?.statusText ?? "",
      durationMs: dur,
      bodyText:
        typeof data === "string" ? data : JSON.stringify(data ?? null, null, 2),
      headersText: headerLines.join("\n") || "—",
    };
  } catch (e) {
    // Ovdje stižu samo pravi mrežni faili (CORS, DNS, offline) - HTTP greške
    // ne bacaju zbog ignoreResponseError.
    result.value = {
      method: `${method.value} ${url}`,
      status: 0,
      statusText: "",
      durationMs: Math.round(performance.now() - t0),
      bodyText: "",
      headersText: "—",
      error:
        "Zahtjev nije stigao do servera (CORS / DNS / offline): " +
        (e as Error).message,
    };
  } finally {
    sending.value = false;
  }
};

const copyResponse = () => {
  if (!result.value) return;
  const text = result.value.error
    ? result.value.error
    : `${result.value.status} ${result.value.statusText}\n\n${result.value.bodyText}`;
  void navigator.clipboard?.writeText(text);
};

const copyCurl = () => {
  const url = resolvedUrl.value;
  const parts = [`curl -sS -i -X ${method.value} '${url}'`];
  const token = activeToken();
  if (token) parts.push(`  -H 'Authorization: Bearer ${token.slice(0, 12)}…'`);
  parts.push(`  -H 'Accept: application/json'`);
  if (method.value !== "GET" && body.value.trim()) {
    parts.push(`  -H 'Content-Type: application/json'`);
    parts.push(`  -d '${body.value.trim().replace(/\s+/g, " ")}'`);
  }
  void navigator.clipboard?.writeText(parts.join(" \\\n"));
};

// --- Prečice ---
type Shortcut = {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  body?: string;
};

const ph = (v: unknown, token: string) =>
  v != null && v !== "" && !Number.isNaN(v) ? String(v) : token;

const SHORTCUTS = computed<{ label: string; items: Shortcut[] }[]>(() => {
  const O = ph(ids.order, "{ORDER}");
  const D = ph(ids.otherOrder, "{DRUGA}");
  const C1 = ph(ids.c1, "{C1}");
  const C2 = ph(ids.c2, "{C2}");
  return [
    {
      label: "Setup",
      items: [
        {
          id: "login",
          name: "dobij token",
          method: "POST",
          path: "/login",
          body: '{\n  "username": "",\n  "password": ""\n}',
        },
        {
          id: "waiting",
          name: "narudžbe koje čekaju kurira",
          method: "GET",
          path: "/dispatcher/orders/waiting?delivery_company_id=24",
        },
        {
          id: "cands",
          name: "candidate-couriers",
          method: "GET",
          path: `/dispatcher/orders/${O}/candidate-couriers?delivery_company_id=24`,
        },
      ],
    },
    {
      label: "PRIORITET 1 — dispečerske offer rute",
      items: [
        {
          id: "D1",
          name: "otvori rundu",
          method: "POST",
          path: `/dispatcher/orders/${O}/offer?delivery_company_id=24`,
          body: `{\n  "courier_ids": [${C1}, ${C2}],\n  "mode": "sequential",\n  "offer_timeout_seconds": 25\n}`,
        },
        {
          id: "D2",
          name: "stanje runde",
          method: "GET",
          path: `/dispatcher/orders/${O}/offers?delivery_company_id=24`,
        },
        {
          id: "D3",
          name: "GET bez runde",
          method: "GET",
          path: `/dispatcher/orders/${D}/offers?delivery_company_id=24`,
        },
        {
          id: "D5b",
          name: "prekid runde (offer/cancel)",
          method: "POST",
          path: `/dispatcher/orders/${O}/offer/cancel`,
          body: '{\n  "delivery_company_id": 24\n}',
        },
      ],
    },
    {
      label: "PRIORITET 2 — kurirska strana (Token override!)",
      items: [
        { id: "K1", name: "GET /courier/offers", method: "GET", path: "/courier/offers" },
        {
          id: "K2",
          name: "offer-response decline",
          method: "POST",
          path: `/orders/${O}/offer-response`,
          body: '{\n  "action": "decline"\n}',
        },
        {
          id: "K3",
          name: "offer-response accept",
          method: "POST",
          path: `/orders/${O}/offer-response`,
          body: '{\n  "action": "accept"\n}',
        },
        {
          id: "K3b",
          name: "moje narudžbe (C1)",
          method: "GET",
          path: `/orders/driver/${C1}`,
        },
      ],
    },
    {
      label: "PRIORITET 3 — broadcasting auth",
      items: [
        {
          id: "S1",
          name: "auth · API host",
          method: "POST",
          path: `${host}/broadcasting/auth`,
          body: `{\n  "socket_id": "123.456",\n  "channel_name": "private-orders.${O}"\n}`,
        },
        {
          id: "S2",
          name: "auth · API host + /api",
          method: "POST",
          path: `${host}/api/broadcasting/auth`,
          body: `{\n  "socket_id": "123.456",\n  "channel_name": "private-orders.${O}"\n}`,
        },
        {
          id: "S3",
          name: "auth · WS host",
          method: "POST",
          path: `https://ws.kurir.ordera.app/broadcasting/auth`,
          body: `{\n  "socket_id": "123.456",\n  "channel_name": "private-orders.${O}"\n}`,
        },
      ],
    },
    {
      label: "PRIORITET 4 — validacione probe POST …/offer",
      items: [
        {
          id: "V1",
          name: "prazan courier_ids",
          method: "POST",
          path: `/dispatcher/orders/${O}/offer?delivery_company_id=24`,
          body: '{\n  "courier_ids": [],\n  "mode": "sequential"\n}',
        },
        {
          id: "V2",
          name: "kurir van liste",
          method: "POST",
          path: `/dispatcher/orders/${O}/offer?delivery_company_id=24`,
          body: '{\n  "courier_ids": [999999999],\n  "mode": "sequential"\n}',
        },
        {
          id: "V3",
          name: "bez mode",
          method: "POST",
          path: `/dispatcher/orders/${O}/offer?delivery_company_id=24`,
          body: `{\n  "courier_ids": [${C1}]\n}`,
        },
        {
          id: "V4",
          name: "mode parallel",
          method: "POST",
          path: `/dispatcher/orders/${O}/offer?delivery_company_id=24`,
          body: `{\n  "courier_ids": [${C1}],\n  "mode": "parallel"\n}`,
        },
        {
          id: "V5",
          name: "timeout 3 (min?)",
          method: "POST",
          path: `/dispatcher/orders/${O}/offer?delivery_company_id=24`,
          body: `{\n  "courier_ids": [${C1}],\n  "mode": "sequential",\n  "offer_timeout_seconds": 3\n}`,
        },
        {
          id: "V6",
          name: "timeout 999 (max?)",
          method: "POST",
          path: `/dispatcher/orders/${O}/offer?delivery_company_id=24`,
          body: `{\n  "courier_ids": [${C1}],\n  "mode": "sequential",\n  "offer_timeout_seconds": 999\n}`,
        },
      ],
    },
  ];
});

const applyShortcut = (s: Shortcut) => {
  method.value = s.method;
  path.value = s.path;
  body.value = s.body ?? "";
  bodyError.value = "";
};
</script>

<style scoped>
.dev-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}

@media (max-width: 900px) {
  .dev-grid {
    grid-template-columns: 1fr;
  }
}

.hint {
  font-size: 0.8rem;
  color: #6b7685;
  word-break: break-all;
}

.section-label {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9aa4b2;
}

.mono :deep(textarea),
.mono,
.out {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.82rem;
}

.out {
  background: #0b1220;
  color: #e7ecf3;
  padding: 12px;
  border-radius: 10px;
  overflow: auto;
  max-height: 60vh;
  white-space: pre-wrap;
  word-break: break-word;
}

code {
  background: rgba(11, 18, 32, 0.06);
  padding: 1px 5px;
  border-radius: 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85em;
}
</style>
