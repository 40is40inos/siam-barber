import type { Lang } from "./config";

export const dict = {
  el: {
    lineDay: "Διάλεξε μέρα.",
    lineTime: "Διάλεξε ώρα.",
    lineName: "Το όνομά σου.",
    at: "στις",
    seeYou: "Τα λέμε!",
    day: "Μέρα",
    time: "Ώρα",
    today: "Σήμερα",
    tomorrow: "Αύριο",
    free: (n: number) => (n === 1 ? "1 ελεύθερη" : `${n} ελεύθερες`),
    full: "Γεμάτη",
    closed: "Κλειστά",
    noTimes: "Δεν έμειναν ώρες αυτή τη μέρα.",
    nextFree: "Επόμενη διαθέσιμη",
    noneInWindow: "Δεν υπάρχουν ελεύθερες ώρες τις επόμενες εβδομάδες.",
    loading: "Φόρτωση ωρών…",
    loadError: "Δεν φορτώθηκαν οι ώρες.",
    retry: "Δοκίμασε ξανά",
    change: "Αλλαγή",
    service: "Υπηρεσία",
    name: "Ονοματεπώνυμο",
    phone: "Κινητό τηλέφωνο",
    note: "Σημείωση (προαιρετικά)",
    notePlaceholder: "π.χ. μόνο ψαλίδι ή έρχομαι με τον γιο μου",
    book: "Κλείσε ραντεβού",
    booking: "Κλείνουμε…",
    noVerify: "Χωρίς κωδικούς και επιβεβαιώσεις. Αν δεν μπορείς να έρθεις, ακύρωσε με ένα πάτημα.",
    errors: {
      invalid_name: "Γράψε το όνομά σου.",
      invalid_phone: "Γράψε ένα έγκυρο τηλέφωνο, π.χ. 691 234 5678.",
      invalid_note: "Η σημείωση είναι πολύ μεγάλη (έως 200 χαρακτήρες).",
      taken: "Μόλις έκλεισε κάποιος αυτή την ώρα. Διάλεξε άλλη.",
      past: "Αυτή η ώρα πέρασε. Διάλεξε άλλη.",
      closed: "Το μαγαζί είναι κλειστό εκείνη τη μέρα.",
      limit: "Έχεις ήδη ραντεβού. Ακύρωσε ένα για να κλείσεις νέο.",
      invalid_slot: "Αυτή η ώρα δεν είναι διαθέσιμη. Διάλεξε άλλη.",
      generic: "Κάτι πήγε στραβά. Δοκίμασε ξανά.",
    } as Record<string, string>,
    pickAnother: "Διάλεξε άλλη ώρα",
    booked: "Το ραντεβού κλείστηκε",
    addCalendar: "Πρόσθεσέ το στο ημερολόγιο",
    cancelLink: "Ακύρωση ραντεβού",
    cancelShort: "Ακύρωση",
    newBooking: "Νέο ραντεβού",
    keepLink: "Αν αλλάξουν τα σχέδιά σου, ακύρωσε από εδώ ή από αυτή τη συσκευή.",
    yourBooking: "Το ραντεβού σου",
    barber: "Κουρέας",
    hours: "Ωράριο",
    prices: "Τιμές",
    directions: "Οδηγίες",
    minutes: "λεπτά",
    weekdaysShort: ["Δευ", "Τρί", "Τετ", "Πέμ", "Παρ", "Σάβ", "Κυρ"],
    cancelTitle: "Ακύρωση ραντεβού",
    cancelConfirm: "Ναι, ακύρωσέ το",
    cancelling: "Ακύρωση…",
    cancelled: "Το ραντεβού ακυρώθηκε.",
    cancelledHint: "Η ώρα ελευθερώθηκε για κάποιον άλλο. Ευχαριστούμε που μας ενημέρωσες.",
    alreadyCancelled: "Αυτό το ραντεβού έχει ήδη ακυρωθεί.",
    cantCancelStarted: "Αυτό το ραντεβού έχει ήδη περάσει.",
    notFound: "Δεν βρέθηκε αυτό το ραντεβού.",
    keep: "Κράτα το",
    backHome: "Κλείσε νέο ραντεβού",
  },
  en: {
    lineDay: "Pick a day.",
    lineTime: "Pick a time.",
    lineName: "Your name.",
    at: "at",
    seeYou: "See you!",
    day: "Day",
    time: "Time",
    today: "Today",
    tomorrow: "Tomorrow",
    free: (n: number) => `${n} free`,
    full: "Full",
    closed: "Closed",
    noTimes: "No times left on this day.",
    nextFree: "Next available",
    noneInWindow: "No free times in the coming weeks.",
    loading: "Loading times…",
    loadError: "Couldn't load the times.",
    retry: "Try again",
    change: "Change",
    service: "Service",
    name: "Full name",
    phone: "Mobile phone",
    note: "Note (optional)",
    notePlaceholder: "e.g. scissors only, or I'm bringing my son",
    book: "Book appointment",
    booking: "Booking…",
    noVerify: "No passwords, no codes. If you can't make it, cancel with one tap.",
    errors: {
      invalid_name: "Please enter your name.",
      invalid_phone: "Enter a valid phone number, e.g. 691 234 5678.",
      invalid_note: "The note is too long (200 characters max).",
      taken: "Someone just booked this time. Please pick another.",
      past: "This time has passed. Please pick another.",
      closed: "The shop is closed that day.",
      limit: "You already have appointments booked. Cancel one to book again.",
      invalid_slot: "This time isn't available. Please pick another.",
      generic: "Something went wrong. Please try again.",
    } as Record<string, string>,
    pickAnother: "Pick another time",
    booked: "You're booked",
    addCalendar: "Add to calendar",
    cancelLink: "Cancel appointment",
    cancelShort: "Cancel",
    newBooking: "New booking",
    keepLink: "If plans change, cancel from here or from this device.",
    yourBooking: "Your appointment",
    barber: "Barber",
    hours: "Hours",
    prices: "Prices",
    directions: "Directions",
    minutes: "min",
    weekdaysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    cancelTitle: "Cancel appointment",
    cancelConfirm: "Yes, cancel it",
    cancelling: "Cancelling…",
    cancelled: "Your appointment is cancelled.",
    cancelledHint: "The time is free again for someone else. Thanks for letting us know.",
    alreadyCancelled: "This appointment was already cancelled.",
    cantCancelStarted: "This appointment has already passed.",
    notFound: "We couldn't find this appointment.",
    keep: "Keep it",
    backHome: "Book a new appointment",
  },
} satisfies Record<Lang, unknown>;

export type Dict = (typeof dict)["el"];

const locales: Record<Lang, string> = { el: "el-GR", en: "en-GB" };

function asDate(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

export function fmtDate(date: string, lang: Lang, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locales[lang], { ...opts, timeZone: "UTC" }).format(asDate(date));
}

/** "Τρίτη 10 Νοεμβρίου" / "Tuesday 10 November" */
export function longDate(date: string, lang: Lang) {
  return fmtDate(date, lang, { weekday: "long", day: "numeric", month: "long" });
}

/** "Τρί 10 Νοε" / "Tue 10 Nov" */
export function shortDate(date: string, lang: Lang) {
  return fmtDate(date, lang, { weekday: "short", day: "numeric", month: "short" }).replace(/[.,]/g, "");
}

export function monthName(date: string, lang: Lang) {
  return fmtDate(date, lang, { month: "long" });
}

export function price(amount: number, lang: Lang) {
  return lang === "el" ? `${amount}€` : `€${amount}`;
}
