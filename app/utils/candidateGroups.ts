import type { CandidateCourier } from "~/types/candidateCourier";
import type { CourierOfferStatus, OfferMode } from "~/types/offer";

// Sekcije u kojima se kandidati prikazuju i u "Listi" i u "Toku" (isti izvor, da
// oba prikaza uvijek pokazuju istu podjelu).
export type CandidateGroup = {
  key: string;
  title: string;
  hint?: string;
  candidates: CandidateCourier[];
};

export type BuildCandidateGroupsInput = {
  candidates: CandidateCourier[];
  statusOf: (candidate: CandidateCourier) => CourierOfferStatus;
  // Kandidatu se ne može poslati ponuda (utils/candidateOfferPolicy).
  isBlocked: (candidate: CandidateCourier) => boolean;
  // Ko je u rundi po backendu (round.candidate_ids). null = runde nema.
  roundCandidateIds: number[] | null;
  // Runda STVARNO teče na serveru (ne samo da se prikazuje istorija).
  roundLive: boolean;
  mode: OfferMode;
};

// Grupe idu redom kako dispečer razmišlja: nije odgovorilo -> trenutno se nudi ->
// sledeći na redu -> kasnije u redu -> neće dobiti ponudu -> ne mogu dobiti
// ponudu. Prazne grupe se izostavljaju.
//
// Ko će dobiti ponudu određuje backend: round.candidate_ids su izabrani kuriri
// (dispečer ih čekira, backend ih još može preskočiti - vidi skippedNotes).
// Ostali iz liste nisu u rundi. Bez runde još niko nije "izabran".
export const buildCandidateGroups = ({
  candidates,
  statusOf,
  isBlocked,
  roundCandidateIds,
  roundLive,
  mode,
}: BuildCandidateGroupsInput): CandidateGroup[] => {
  const idle = candidates.filter((c) => statusOf(c) === "none");
  // Kandidati kojima se ponuda uopšte ne može poslati (na isporuci, limit
  // gotovine, nedostupan - zavisi od postavki firme) - zasebna grupa na kraju.
  const waiting = idle.filter((c) => !isBlocked(c));
  const blocked: CandidateGroup = {
    key: "blocked",
    title: "Ne mogu dobiti ponudu",
    hint: "Na isporuci, preko limita gotovine ili nedostupni - prema pravilima firme.",
    candidates: idle.filter((c) => isBlocked(c)),
  };
  const inRound = roundCandidateIds ? new Set(roundCandidateIds) : null;
  const sequential = mode === "sequential";

  const history: CandidateGroup[] = [
    {
      key: "expired",
      title: "Nije odgovorilo / odbilo",
      candidates: candidates.filter((c) =>
        ["expired", "declined", "superseded"].includes(statusOf(c))
      ),
    },
    {
      key: "current",
      title: "Trenutno se nudi",
      candidates: candidates.filter((c) => ["pending", "accepted"].includes(statusOf(c))),
    },
  ];

  const nonEmpty = (groups: CandidateGroup[]) => groups.filter((g) => g.candidates.length > 0);

  // Nema runde: samo rangirana lista kandidata.
  if (!inRound) {
    return nonEmpty([...history, { key: "all", title: "Kandidati", candidates: waiting }, blocked]);
  }

  // Runda više ne teče (zatvorena/iscrpljena/prihvaćena) - niko više neće dobiti ponudu.
  if (!roundLive) {
    return nonEmpty([
      ...history,
      { key: "never", title: "Nisu dobili ponudu", candidates: waiting },
      blocked,
    ]);
  }

  const queued = waiting.filter((c) => inRound.has(c.courierId));
  const next = sequential ? queued.slice(0, 1) : [];
  const later = sequential ? queued.slice(1) : queued;
  return nonEmpty([
    ...history,
    { key: "next", title: "Sledeći na redu", candidates: next },
    { key: "later", title: sequential ? "Kasnije u redu" : "Čeka ponudu", candidates: later },
    {
      key: "never",
      title: "Neće dobiti ponudu",
      hint: "Nisu izabrani za ovu rundu.",
      candidates: waiting.filter((c) => !inRound.has(c.courierId)),
    },
    blocked,
  ]);
};

// Stanje "izaberi sve" checkboxa u zaglavlju grupe. Obuhvata samo kandidate kojima
// se ponuda smije poslati (zaključani se ne čekiraju ni pojedinačno).
export type GroupSelectionState = {
  // ID-jevi koji se čekiraju/odčekiraju ovim checkboxom.
  ids: number[];
  // Svi izabrani / neki izabrani (tri-stanje: sve, djelimično, ništa).
  all: boolean;
  some: boolean;
  // Nema šta da se izabere (svi zaključani) ili je runda u toku.
  disabled: boolean;
};

export const groupSelectionState = (
  group: CandidateGroup,
  selectedSet: Set<number>,
  isSendLocked: (candidate: CandidateCourier) => boolean,
  roundLocked: boolean
): GroupSelectionState => {
  const ids = group.candidates.filter((c) => !isSendLocked(c)).map((c) => c.courierId);
  const selected = ids.filter((id) => selectedSet.has(id)).length;
  return {
    ids,
    all: ids.length > 0 && selected === ids.length,
    some: selected > 0 && selected < ids.length,
    disabled: roundLocked || ids.length === 0,
  };
};
