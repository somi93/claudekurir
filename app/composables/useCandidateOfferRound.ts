import { computed, ref, watch, type Ref } from "vue";
import { useOrderOfferRound } from "~/composables/useOrderOfferRound";
import type { CandidateCourier } from "~/types/candidateCourier";
import type { CourierOfferStatus, OfferMode } from "~/types/offer";

type ChipMeta = { color: string; label: string };

const OFFER_STATUS_META: Record<CourierOfferStatus, ChipMeta> = {
  none: { color: "grey", label: "Na čekanju reda" },
  pending: { color: "info", label: "Čeka odgovor" },
  accepted: { color: "success", label: "Prihvatio ✓" },
  declined: { color: "error", label: "Odbio ponudu" },
  expired: { color: "warning", label: "Nije odgovorio" },
  superseded: { color: "default", label: "Preskočen" },
};

// UI sloj oko useOrderOfferRound() specifičan za CandidateCouriersPanel:
// čekiranje kandidata, mod (redom/paralelno), poruke i chip po kuriru. Sam
// socket/poll mehanizam i stanje runde su u useOrderOfferRound().
export const useCandidateOfferRound = (
  orderId: Ref<number | null>,
  getCompanyId: () => number | null,
  displayCandidates: Ref<CandidateCourier[]>,
  legacyAssign: (orderId: number, courierId: number) => Promise<void>,
  // Slanje ponude zaključano za kandidata (utils/candidateOfferPolicy) - ne može
  // se čekirati, a ako je već bio čekiran pa postao zaključan, ne šalje mu se.
  isSendLocked: (c: CandidateCourier) => boolean = () => false
) => {
  const offerRound = useOrderOfferRound();

  const offerMode = ref<OfferMode>("sequential");
  const selectedSet = ref<Set<number>>(new Set());
  const selectedCourierIds = computed<number[]>(() =>
    // Redoslijed iz rangirane liste (bitno za "sequential").
    displayCandidates.value
      .filter((c) => selectedSet.value.has(c.courierId) && !isSendLocked(c))
      .map((c) => c.courierId)
  );
  const toggleSelected = (courierId: number) => {
    const candidate = displayCandidates.value.find((c) => c.courierId === courierId);
    if (candidate && isSendLocked(candidate)) return;
    const next = new Set(selectedSet.value);
    if (next.has(courierId)) next.delete(courierId);
    else next.add(courierId);
    selectedSet.value = next;
  };

  // "Izaberi sve" u grupi: čekiraj (on) ili odčekiraj više kandidata odjednom.
  // Zaključani se ne čekiraju, isto kao kod pojedinačnog toggleSelected.
  const setSelected = (courierIds: number[], on: boolean) => {
    const byId = new Map(displayCandidates.value.map((c) => [c.courierId, c]));
    const next = new Set(selectedSet.value);
    for (const id of courierIds) {
      if (!on) {
        next.delete(id);
        continue;
      }
      const candidate = byId.get(id);
      if (candidate && !isSendLocked(candidate)) next.add(id);
    }
    selectedSet.value = next;
  };

  const offerSending = computed(() => offerRound.sending.value);
  const offerSendingCourierId = ref<number | null>(null);
  const offerRoundActiveHere = computed(
    () =>
      offerRound.activeOrderId.value !== null &&
      offerRound.activeOrderId.value === orderId.value
  );
  // Da li postoji STVARNO aktivna runda (ne samo da je panel prati/prikazuje).
  // `offerRoundActiveHere` ostaje true i dok panel samo PRIKAZUJE već riješenu
  // rundu (accepted/exhausted - vidi `watchOrder()`, "hasLiveRound" gleda i
  // `offers.length > 0` da bi zadržao istoriju vidljivom), a jednom riješena
  // runda više ne blokira ništa na serveru (backend cancel vraća 409 "Nema
  // aktivne ponude" za nju - potvrđeno uživo 14.09). Koristi se i za "Zatvori
  // rundu" dugme i za zaključavanje čekiranja/mode ispod - oboje treba da se
  // otključaju čim runda pređe u terminalno stanje, ne tek kad se eksplicitno
  // zatvori (inače nema izlaza - "Zatvori rundu" više ni ne postoji za
  // riješenu rundu, a "Osveži" je re-zaključavao istim heuristikom).
  const offerRoundCancelable = computed(
    () => offerRoundActiveHere.value && offerRound.roundActive.value
  );

  // Runda riješena time što je NEKO prihvatio - narudžba je dodijeljena, slanje
  // daljih ponuda ovim panelom nema smisla (backend bi ionako 409-ovao). Za
  // razliku od exhausted/canceled, ovo se NE otključava - "Zatvori rundu" ni
  // ne postoji za nju (canCancel i dalje zavisi samo od `roundActive`).
  const offerRoundAccepted = computed(
    () => offerRoundActiveHere.value && offerRound.round.value.roundStatus === "accepted"
  );

  // Dok runda STVARNO traje ILI je već neko prihvatio, čekiranje/mode/per-red
  // dugmad su zaključani. Jedino exhausted/canceled otključava (nova runda za
  // istu narudžbu ide tek poslije "Zatvori rundu" ili poslije što se prethodna
  // sama riješi) - i dalje se prikazuje njena istorija (chip, per-red status)
  // preko `offerRoundActiveHere`.
  const offerRoundLocked = computed(
    () => offerRoundCancelable.value || offerRoundAccepted.value
  );

  // Kandidat koji je prihvatio - za karticu koja to jasno prikazuje ispod trake
  // (vidi CandidateCouriersPanel). `courierId` se čuva odvojeno od `candidate`
  // jer prihvaćeni kurir teorijski može ispasti iz `displayCandidates` (filter/
  // re-load) - kartica tad i dalje ima ID da prikaže makar to.
  const acceptedOffer = computed(() => {
    if (!offerRoundAccepted.value) return null;
    return offerRound.round.value.offers.find((o) => o.status === "accepted") ?? null;
  });
  const acceptedCandidate = computed<CandidateCourier | null>(() => {
    const offer = acceptedOffer.value;
    if (!offer) return null;
    return displayCandidates.value.find((c) => c.courierId === offer.courierId) ?? null;
  });

  const offerMessage = ref("");
  const offerMessageType = ref<"success" | "error" | "info">("info");
  const setOfferMessage = (text: string, type: "success" | "error" | "info") => {
    offerMessage.value = text;
    offerMessageType.value = type;
  };

  // `offerRound.errorMessage` se sam briše na sledećem uspješnom `load()` (10s
  // fallback poll) - ali samo watch-ovan u JEDNOM smjeru (ranije verzije koda)
  // je značilo da se `offerMessage` alert nikad ne skloni kad greška prođe
  // (potvrđeno uživo 14.09 - K7a offline/online test, "Nema veze sa serverom"
  // je ostajao zaglavljen i posle povratka konekcije). Sad čistimo `offerMessage`
  // i u suprotnom smjeru - ali SAMO ako je trenutno prikazana poruka baš ova
  // greška (`offerMessageType === "error"`), da ne pobrišemo npr. netom
  // prikazanu "Ponuda poslata" poruku slučajnim poklapanjem tajminga.
  watch(
    () => offerRound.errorMessage.value,
    (msg) => {
      if (msg) {
        setOfferMessage(msg, "error");
      } else if (offerMessageType.value === "error") {
        offerMessage.value = "";
      }
    }
  );

  // Kuriri koje backend nije uključio u rundu + razlog. Backend šalje samo tekst
  // ("Kurir #30189 trenutno vozi drugu dostavu.") pa "#ID" zamjenjujemo
  // "Ime Prezime (#ID)" iz liste kandidata - ID ostaje jer se po njemu kurir
  // nalazi na ostalim ekranima. Ako kurira nema u listi, tekst ide nepromijenjen.
  const skippedNotes = computed<string[]>(() =>
    offerRound.skipped.value.map(({ courierId, message }) => {
      if (courierId == null) return message;
      const name = displayCandidates.value.find((c) => c.courierId === courierId)?.name;
      if (!name) return message;
      return message.replace(`#${courierId}`, () => `${toLatin(name)} (#${courierId})`);
    })
  );
  const skippedIds = computed(
    () => new Set(offerRound.skipped.value.map((s) => s.courierId))
  );
  const dismissSkipped = () => {
    offerRound.skipped.value = [];
  };

  // Ko je u rundi po backendu (round.candidate_ids). null dok runde nema.
  const roundCandidateIds = computed<number[] | null>(() =>
    offerRoundActiveHere.value ? offerRound.round.value.candidateIds : null
  );

  const roundChip = computed<ChipMeta>(() => {
    switch (offerRound.round.value.roundStatus) {
      case "accepted":
        return { color: "success", label: "Runda: prihvaćena" };
      case "exhausted":
        return { color: "warning", label: "Runda: niko nije prihvatio" };
      case "canceled":
        return { color: "default", label: "Runda: zatvorena" };
      default:
        return { color: "info", label: "Runda: u toku" };
    }
  });

  const offerChipFor = (courierId: number): ChipMeta | null => {
    if (!offerRoundActiveHere.value) return null;
    const offer = offerRound.offerFor(courierId);
    if (!offer) return null;
    const meta = OFFER_STATUS_META[offer.status];
    if (offer.status === "pending") {
      const left = offerRound.secondsLeft(offer);
      return { color: meta.color, label: left != null ? `Čeka odgovor · ${left}s` : "Čeka odgovor" };
    }
    return meta;
  };

  // Sirovo stanje (bez formatiranog labela) za prikaze koji sami crtaju status,
  // npr. OfferRoundTrack - "none" i kad runda uopšte ne postoji (kandidat samo
  // još nije ponuđen), da traka ima za šta da oboji i pre prve poslate ponude.
  const offerStatusFor = (
    courierId: number
  ): {
    status: CourierOfferStatus;
    secondsLeft: number | null;
    pushSent: boolean | null;
    socketReceivedAt: Date | null;
  } => {
    if (!offerRoundActiveHere.value) {
      return { status: "none", secondsLeft: null, pushSent: null, socketReceivedAt: null };
    }
    const offer = offerRound.offerFor(courierId);
    if (!offer) return { status: "none", secondsLeft: null, pushSent: null, socketReceivedAt: null };
    return {
      status: offer.status,
      secondsLeft: offer.status === "pending" ? offerRound.secondsLeft(offer) : null,
      pushSent: offer.pushSent,
      socketReceivedAt: offer.socketReceivedAt,
    };
  };

  // Poziva se kad panel krene novu pretragu - resetuje čekiranje/poruku od
  // prethodne narudžbe.
  const resetForNewSearch = () => {
    offerRound.stop();
    selectedSet.value = new Set();
    offerMessage.value = "";
  };

  // Bulk: pošalji ponudu svim čekiranim kandidatima (redom / paralelno).
  const sendOffer = async () => {
    const id = orderId.value;
    const companyId = getCompanyId();
    if (!id || selectedCourierIds.value.length === 0 || companyId == null) return;
    offerMessage.value = "";
    const selected = selectedCourierIds.value;
    const opened = await offerRound.open(id, companyId, selected, offerMode.value);
    if (opened) {
      // Preskočeni kuriri nisu dobili ponudu - poruka ne smije tvrditi suprotno
      // (razlozi su u zasebnom upozorenju, vidi skippedNotes).
      const skippedCount = selected.filter((cid) => skippedIds.value.has(cid)).length;
      if (skippedCount === selected.length) {
        setOfferMessage("Ponuda nije poslata nijednom od izabranih kurira.", "error");
      } else if (skippedCount > 0) {
        setOfferMessage(
          offerMode.value === "sequential"
            ? "Ponuda poslata — kreće redom od prvog kurira koji je dostupan."
            : "Ponuda poslata dostupnim izabranim kuririma.",
          "success"
        );
      } else {
        setOfferMessage(
          offerMode.value === "sequential"
            ? "Ponuda poslata — kreće redom od prvog izabranog kurira."
            : "Ponuda poslata svim izabranim kuririma.",
          "success"
        );
      }
      return;
    }
    // Offer rute još nema na backendu -> legacy jednokratni accept, ali samo za
    // jednog izabranog kurira (multi-ponuda bez tih ruta nije moguća).
    if (offerRound.offerApiMissing.value) {
      if (selectedCourierIds.value.length === 1) {
        await legacyAssign(id, selectedCourierIds.value[0]!);
      } else {
        setOfferMessage(
          "Ponuda više kurira još nije aktivna na serveru — izaberi jednog kurira ili koristi „Pošalji ponudu“ u redu.",
          "info"
        );
      }
    }
  };

  // Per-red: ponudi samo tom kuriru (runda sa jednim kandidatom).
  const onOfferOne = async (candidate: CandidateCourier) => {
    const id = orderId.value;
    const companyId = getCompanyId();
    if (!id || companyId == null) return;
    offerMessage.value = "";
    offerSendingCourierId.value = candidate.courierId;
    try {
      const opened = await offerRound.open(id, companyId, [candidate.courierId], offerMode.value);
      if (!opened && offerRound.offerApiMissing.value) {
        // Fallback na stari tok - identično ponašanje kao ranije.
        await legacyAssign(id, candidate.courierId);
      } else if (opened) {
        if (skippedIds.value.has(candidate.courierId)) {
          setOfferMessage(`Ponuda nije poslata kuriru ${toLatin(candidate.name)}.`, "error");
        } else {
          setOfferMessage(`Ponuda poslata kuriru ${toLatin(candidate.name)}.`, "success");
        }
      }
    } finally {
      offerSendingCourierId.value = null;
    }
  };

  return {
    offerMode,
    selectedSet,
    selectedCourierIds,
    toggleSelected,
    setSelected,
    offerSending,
    offerSendingCourierId,
    offerRoundActiveHere,
    offerRoundLocked,
    offerRoundCancelable,
    offerRoundAccepted,
    acceptedOffer,
    acceptedCandidate,
    offerMessage,
    offerMessageType,
    skippedNotes,
    dismissSkipped,
    roundCandidateIds,
    roundChip,
    offerChipFor,
    offerStatusFor,
    resetForNewSearch,
    watchExistingRound: offerRound.watchOrder,
    sendOffer,
    onOfferOne,
    closeRound: offerRound.cancel,
  };
};
