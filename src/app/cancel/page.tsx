import type { Metadata } from "next";
import { CancelView } from "@/components/booking/CancelView";

export const metadata: Metadata = {
  title: "Siam Barber · Ακύρωση ραντεβού",
  robots: { index: false, follow: false },
};

/* The booking token travels in the URL fragment (/cancel#token), so it never reaches server logs. */
export default function CancelPage() {
  return <CancelView />;
}
