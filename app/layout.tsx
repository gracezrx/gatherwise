import type { Metadata } from "next";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_GATHERWISE_CANONICAL_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Gatherwise",
    template: "%s | Gatherwise"
  },
  description:
    "Gatherwise plans social outings with real place discovery, transparent ranking, and safe booking handoff.",
  openGraph: {
    title: "Gatherwise",
    description:
      "Social planning with real place discovery, transparent ranking, and booking handoff.",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
