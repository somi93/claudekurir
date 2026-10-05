// Predlog privremene lozinke za novog kurira (16.08) - dispecer je i dalje
// slobodan da rucno prepise polje. Sistem ne salje email/SMS, pa dispecer
// mora sam da je prenese kuriru - izbacujemo vizuelno slicne karaktere
// (0/O, 1/l/I) da se lakse izdiktira telefonom.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export const generateTemporaryPassword = (length = 10): string => {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join("");
};
