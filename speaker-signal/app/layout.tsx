import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Origination Desk | Candid Intelligence",
  description: "Project intelligence, qualified speakers, and event-anchored outreach in one origination desk.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
