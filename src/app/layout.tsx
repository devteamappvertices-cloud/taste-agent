import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Taste Agent: find what you'll both love",
  description:
    "Different tastes? Tell Taste Agent what each of you likes and get movies, shows, music, restaurants and trips you'll all enjoy, ranked by Qloo's taste graph.",
  keywords: [
    "what to watch",
    "movie recommendations",
    "TV show recommendations",
    "music recommendations",
    "book recommendations",
    "podcast recommendations",
    "restaurant recommendations",
    "travel ideas",
    "personalized recommendations",
    "date night ideas",
    "movie night for couples",
    "what to watch together",
    "AI recommendations",
    "taste profile",
    "Qloo",
    "United States",
    "Canada",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
