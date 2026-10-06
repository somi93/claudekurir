// utils/courierStatus.ts
var LONG_OFFLINE_MS = 60 * 60 * 1e3;

// utils/currency.ts
var toAmount = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text2 = value.trim().replace(",", ".");
  if (!text2) return null;
  const parsed = Number(text2);
  return Number.isFinite(parsed) ? parsed : null;
};

// utils/profileForm.ts
var digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");
var DOB_MESSAGES = {
  incomplete: "Upi\u0161i dan, mjesec i godinu, npr. 14.03.1996.",
  invalid: "Taj datum ne postoji. Provjeri dan i mjesec.",
  future: "Datum je u budu\u0107nosti.",
  young: "Datum je neta\u010Dan: najmla\u0111i kurir ima 14 godina.",
  old: "Datum je neta\u010Dan: provjeri godinu."
};
var ibanClean = (value) => String(value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

// utils/toLatin.ts
var CYRILLIC = "\u0410_\u0411_\u0412_\u0413_\u0414_\u0402_\u0415_\u0401_\u0416_\u0417_\u0418_\u0419_\u0408_\u041A_\u041B_\u0409_\u041C_\u041D_\u040A_\u041E_\u041F_\u0420_\u0421_\u0422_\u040B_\u0423_\u0424_\u0425_\u0426_\u0427_\u040F_\u0428_\u0429_\u042A_\u042B_\u042C_\u042D_\u042E_\u042F_\u0430_\u0431_\u0432_\u0433_\u0434_\u0452_\u0435_\u0451_\u0436_\u0437_\u0438_\u0439_\u0458_\u043A_\u043B_\u0459_\u043C_\u043D_\u045A_\u043E_\u043F_\u0440_\u0441_\u0442_\u045B_\u0443_\u0444_\u0445_\u0446_\u0447_\u045F_\u0448_\u0449_\u044A_\u044B_\u044C_\u044D_\u044E_\u044F".split(
  "_"
);
var LATIN = "A_B_V_G_D_\u0110_E_\xCB_\u017D_Z_I_J_J_K_L_Lj_M_N_Nj_O_P_R_S_T_\u0106_U_F_H_C_\u010C_D\u017E_\u0160_\u015C_\u02BA_Y_\u02B9_\xC8_\xDB_\xC2_a_b_v_g_d_\u0111_e_\xEB_\u017E_z_i_j_j_k_l_lj_m_n_nj_o_p_r_s_t_\u0107_u_f_h_c_\u010D_d\u017E_\u0161_\u015D_\u02BA_y_\u02B9_\xE8_\xFB_\xE2".split(
  "_"
);
var HAS_CYRILLIC = /[\u0400-\u04FF]/;
var cyrillicToLatin = (input) => {
  if (!HAS_CYRILLIC.test(input)) return input;
  return input.split("").map((char) => {
    const index = CYRILLIC.indexOf(char);
    return index === -1 ? char : LATIN[index] ?? char;
  }).join("");
};
var toLatin = (value) => {
  if (!value) return "";
  return cyrillicToLatin(String(value));
};

// utils/searchFold.ts
var foldForSearch = (value) => String(value ?? "").toLowerCase().replace(/đ/g, "dj").normalize("NFD").replace(/[̀-ͯ]/g, "");
var searchNeedle = (query) => foldForSearch(toLatin(query)).replace(/^\s*#/, "").trim();

// utils/courierRoster.ts
var text = (value) => String(value ?? "").trim();
var p2 = (n) => String(n).padStart(2, "0");
var isoDay = (value) => {
  const s = text(value);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
var splitName = (full) => {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
};
var buildRoster = (rows, sources = {}) => {
  const loc = new Map((sources.locations ?? []).map((l) => [l.courier_id, l]));
  const bal = new Map((sources.balances ?? []).map((b) => [b.courier_id, b]));
  const sum = new Map((sources.summary ?? []).map((s) => [s.courierId, s]));
  const balancesKnown = sources.balances != null;
  return rows.map((row) => {
    const separate = row.first_name != null;
    const parsed = splitName(String(row.name ?? ""));
    const first = text(separate ? row.first_name : parsed.first);
    const last = text(separate ? row.last_name : parsed.last);
    const detail = row.detail ?? null;
    const balance = bal.get(row.courier_id);
    const summary = sum.get(row.courier_id);
    return {
      id: row.courier_id,
      first,
      last,
      name: toLatin(`${first} ${last}`.trim()),
      phone: text(row.phone) || null,
      email: text(row.email) || null,
      vehicle: row.vehicle?.type ?? null,
      suspended: Boolean(row.suspended),
      reason: text(row.suspended_reason) || null,
      suspendedAt: row.suspended_at ?? null,
      created: isoDay(row.created_at),
      dob: isoDay(detail?.date_of_birth),
      iban: ibanClean(detail?.iban),
      ecName: text(detail?.emergency_contact_name),
      ecPhone: text(detail?.emergency_contact_phone),
      payType: row.paying_type ?? null,
      paying: text(row.paying),
      bank: text(row.bank_account),
      signed: isoDay(row.contract_signed_at),
      from: isoDay(row.contract_active_from),
      note: text(row.note),
      loc: loc.get(row.courier_id)?.location ?? null,
      cash: balancesKnown ? toAmount(balance?.cash_owed_to_company) ?? 0 : null,
      wage: balancesKnown ? toAmount(balance?.wage_owed_to_courier) ?? 0 : null,
      unread: summary?.dispatcherUnreadCount ?? 0,
      // Ponuda za dostavu nije poruka dispečera: inbox-summary je zna vratiti kao zadnju poruku
      // (dokument 21.09, R11), pa se ovdje ne čuva ("Zadnja poruka" tada pada na čitanje sandučeta).
      lastMsg: summary?.lastMessage && summary.lastMessage.category !== "offer" ? {
        title: summary.lastMessage.title,
        sentAt: summary.lastMessage.sentAt,
        category: summary.lastMessage.category
      } : null
    };
  });
};
var phoneKey = (raw) => {
  const s = text(raw);
  let d = digitsOnly(s);
  if (!d) return "";
  const intl = s.startsWith("+") || d.startsWith("00");
  if (s.startsWith("+")) d = d.slice(3);
  else if (d.startsWith("00")) d = d.slice(5);
  else if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("0") && intl) d = d.slice(1);
  return d;
};
var PHONEISH = /^[\d\s+()/.-]+$/;
var keys = /* @__PURE__ */ new WeakMap();
var keyOf = (c) => {
  let k = keys.get(c);
  if (!k) {
    k = {
      hay: `${foldForSearch(toLatin(`${c.first} ${c.last}`))} ${c.id} ${foldForSearch(c.email)}`,
      pk: phoneKey(c.phone),
      raw: digitsOnly(c.phone)
    };
    keys.set(c, k);
  }
  return k;
};
var matchCourier = (c, query) => {
  const n = searchNeedle(query);
  if (!n) return true;
  const key = keyOf(c);
  if (PHONEISH.test(n) && digitsOnly(n).length >= 3) {
    const qd = digitsOnly(n);
    const qk = phoneKey(n);
    const anchored = n.startsWith("+") || qd.startsWith("0");
    return String(c.id).includes(qd) || !!key.pk && !!qk && (anchored ? key.pk.startsWith(qk) : key.pk.includes(qk)) || !!key.raw && key.raw.includes(qd);
  }
  return n.split(/\s+/).filter(Boolean).every((t) => key.hay.includes(t));
};
var DAY_MESSAGES = {
  incomplete: DOB_MESSAGES.incomplete,
  invalid: DOB_MESSAGES.invalid,
  range: "Provjeri godinu."
};
export {
  buildRoster,
  matchCourier,
  toLatin
};
