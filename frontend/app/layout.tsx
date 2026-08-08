import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Montserrat, Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemePreference } from "@/components/ThemePreference";
import { ViewRoleProvider } from "@/lib/ViewRoleContext";
import { ViewPreferencesProvider } from "@/lib/useViewPreferences";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** SelectQuote marketing site uses Montserrat (body) and Poppins (headlines). */
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "SelectQuote OKR Management",
  description:
    "Internal OKR portal for SelectQuote Insurance Services. Align objectives across teams that help customers find the right coverage.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Ensure layout reads env at request time (Docker/Render set NEXT_PUBLIC_API_URL at runtime, not build). */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const backendOrigin = (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    ""
  ).replace(/\/$/, "");

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${poppins.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__OKR_BACKEND_ORIGIN__=${JSON.stringify(backendOrigin)};`,
          }}
        />
        <ThemePreference />
        <ViewRoleProvider>
          <ViewPreferencesProvider>
            {children}
            <Toaster richColors position="top-right" />
          </ViewPreferencesProvider>
        </ViewRoleProvider>
      </body>
    </html>
  );
}
