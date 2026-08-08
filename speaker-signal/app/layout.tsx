import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Speaker Signal | Candid Intelligence",
  description: "Conference intelligence, qualified speakers, and event-anchored outreach in one signal desk.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
