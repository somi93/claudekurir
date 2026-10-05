import type { CourierProfileDto } from "~/types/courier";
import type { VehicleKey } from "~/types/vehicle";

export type CourierProfile = {
  id: number;
  name: string;
  lastname: string;
  email: string;
  phone: string;
  // null = kurir nema registrovano vozilo (ide pješice) - stvarno stanje, ne greška
  // (potvrđeno 28.08, stavka 4.3). Nikad se ne zamjenjuje "izmišljenim" izborom.
  vehicle: VehicleKey | null;
  vehicleNote: string;
  // Lični podaci (user_details, 13.09) - "" kad prazno, isto ponašanje kao
  // ostala string polja ovdje (forma ih drži kao proste tekst input-e).
  dateOfBirth: string;
  iban: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  // Dan otvaranja naloga (YYYY-MM-DD, lokalni dan) ili "" - značenje polja created_at nije
  // potvrđeno (04.10, stavka 15), pa ga ekran piše uz "Nalog otvoren" samo kad stigne.
  createdAt: string;
};

// `detail.date_of_birth` stiže kao pun ISO datum-vrijeme sa "Z" (potvrđeno
// 28.09) - NE kao gola "YYYY-MM-DD" koju GlobalDatePicker očekuje
// (parseIso tamo radi string.split("-") i puca na "T..." repu). Čita se kroz
// lokalne Date gettere (isti obrazac kao formatDateTime), ne string-slice, da
// se izbjegne pomak dana ako je UTC vrijeme blizu granice ponoći.
const toDateInputValue = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const mapCourierProfileDto = (dto: CourierProfileDto): CourierProfile => ({
  id: dto.id,
  name: dto.name ?? "",
  lastname: dto.lastname ?? "",
  email: dto.email ?? "",
  phone: dto.phone ?? "",
  vehicle: dto.vehicle?.type ?? null,
  vehicleNote: dto.vehicle?.name ?? "",
  dateOfBirth: toDateInputValue(dto.detail?.date_of_birth),
  iban: dto.detail?.iban ?? "",
  emergencyContactName: dto.detail?.emergency_contact_name ?? "",
  emergencyContactPhone: dto.detail?.emergency_contact_phone ?? "",
  createdAt: toDateInputValue(dto.created_at),
});
