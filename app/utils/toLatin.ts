// Port `toLatin` metode iz restorani-front (src/main.js) - konvertuje ćirilične
// znakove u latinicu za dinamičke podatke koje unosi korisnik ili vraća backend:
// lična imena, nazivi restorana, gradovi, ulice, zone, nazivi hrane itd.
//
// U restorani-front ta metoda vraća original kad je aktivni jezik ćirilički
// (sr/rs/ru), inače konvertuje. Ova aplikacija još nema izbor jezika i
// podrazumijeva latinicu, pa se ćirilica uvijek prebacuje. Kad se doda i18n,
// ovdje se vraća provjera lokala (ćirilički lokali vrate string netaknut).
//
// Mapa je 1:1 prekopirana iz npm paketa `cyrillic-to-latin` v2.0.0 koji
// restorani-front koristi (var convert = require("cyrillic-to-latin")), da
// konverzija bude identična.

const CYRILLIC =
  "А_Б_В_Г_Д_Ђ_Е_Ё_Ж_З_И_Й_Ј_К_Л_Љ_М_Н_Њ_О_П_Р_С_Т_Ћ_У_Ф_Х_Ц_Ч_Џ_Ш_Щ_Ъ_Ы_Ь_Э_Ю_Я_а_б_в_г_д_ђ_е_ё_ж_з_и_й_ј_к_л_љ_м_н_њ_о_п_р_с_т_ћ_у_ф_х_ц_ч_џ_ш_щ_ъ_ы_ь_э_ю_я".split(
    "_"
  );

const LATIN =
  "A_B_V_G_D_Đ_E_Ë_Ž_Z_I_J_J_K_L_Lj_M_N_Nj_O_P_R_S_T_Ć_U_F_H_C_Č_Dž_Š_Ŝ_ʺ_Y_ʹ_È_Û_Â_a_b_v_g_d_đ_e_ë_ž_z_i_j_j_k_l_lj_m_n_nj_o_p_r_s_t_ć_u_f_h_c_č_dž_š_ŝ_ʺ_y_ʹ_è_û_â".split(
    "_"
  );

// Sva slova iz mape iznad su u bloku U+0400-U+04FF. Gotovo sav tekst je već
// latinica, a konverzija po znaku nije jeftina za liste od hiljadu i više redova.
const HAS_CYRILLIC = /[\u0400-\u04FF]/;

/** Zamijeni svaki ćirilični znak latiničnim ekvivalentom; ostalo ostaje isto. */
export const cyrillicToLatin = (input: string): string => {
  if (!HAS_CYRILLIC.test(input)) return input;
  return input
    .split("")
    .map((char) => {
      const index = CYRILLIC.indexOf(char);
      return index === -1 ? char : (LATIN[index] ?? char);
    })
    .join("");
};

/**
 * Prikaz ćiriličnih vrijednosti u latinici. Prazna/nullna vrijednost vraća "".
 * Zvati na svakom mjestu gdje se prikazuju imena, adrese, gradovi, zone i sl.
 */
export const toLatin = (value: string | null | undefined): string => {
  if (!value) return "";
  return cyrillicToLatin(String(value));
};
