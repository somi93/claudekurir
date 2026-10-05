// Zajednička biblioteka pravila za Vuetify v-form :rules - svako pravilo
// vraća (value) => true | string, pa se lako kombinuju: :rules="[required('Ime')]".
export const useValidationRules = () => {
  const required = () => (value: unknown) => {
    if (typeof value === "string" ? !value.trim() : !value) {
      return `Polje je obavezno.`;
    }
    return true;
  };

  const email = () => (value: string) => {
    if (!value) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || "Unesi ispravan email.";
  };

  const phone = () => (value: string) => {
    if (!value) return true;
    // "/" i "." su dozvoljeni ("062/519-315"); isto pravilo kao PHONE_PATTERN u utils/profileForm.
    return /^[+]?[\d\s()./-]{6,20}$/.test(value) || "Unesi ispravan broj telefona.";
  };

  const minLength = (label: string, min: number) => (value: string) => {
    if (!value) return true;
    return value.trim().length >= min || `${label} mora imati bar ${min} karaktera.`;
  };

  const positiveNumber = () => (value: unknown) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return "Unesi iznos veći od 0.";
    return true;
  };

  const positiveInteger = () => (value: unknown) => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1) return "Unesi ceo broj veći ili jednak 1.";
    return true;
  };

  const range = (min: number, max: number) => (value: unknown) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < min || num > max) {
      return `Unesi vrednost između ${min} i ${max}.`;
    }
    return true;
  };

  const dateNotBefore = (minDate: string) => (value: string) => {
    if (!value || !minDate) return true;
    return value >= minDate || "Datum ne može biti pre početnog datuma.";
  };

  return {
    required,
    email,
    phone,
    minLength,
    positiveNumber,
    positiveInteger,
    range,
    dateNotBefore,
  };
};
