import type { Metadata, Viewport } from "next";
import { Manrope, Syne } from "next/font/google";
import { LangProvider } from "@/components/LangProvider";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin", "greek"],
  weight: ["600", "700", "800"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "greek"],
});

export const metadata: Metadata = {
  title: "Siam Barber · Κλείσε ραντεβού",
  description: "Κλείσε ραντεβού στο Siam Barber σε λίγα δευτερόλεπτα: μέρα, ώρα, όνομα, τέλος.",
};

export const viewport: Viewport = {
  themeColor: "#0c0b0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="el" className={`${syne.variable} ${manrope.variable} h-full antialiased`}>
      <body className="min-h-full">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
