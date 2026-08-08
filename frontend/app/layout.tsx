import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist, Geist_Mono, Manrope, Montserrat, Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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

const gcDisplay = Barlow_Condensed({
  variable: "--font-gc-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const gcSans = Manrope({
  variable: "--font-gc-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "GridConnects",
    template: "%s | GridConnects",
  },
  description:
    "GridConnects turns fragmented public signals into one live view of the projects taking shape, the people driving them, and the moment to reach out.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: ["/favicon.svg"],
    apple: [{ url: "/favicon.svg" }],
  },
  applicationName: "GridConnects",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FF4F00",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const theme = localStorage.getItem("atlas-theme") || "light"; document.documentElement.classList.toggle("dark", theme === "dark"); document.documentElement.dataset.theme = theme; } catch {} })();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${poppins.variable} ${gcDisplay.variable} ${gcSans.variable} antialiased`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
