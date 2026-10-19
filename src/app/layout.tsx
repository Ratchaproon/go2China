import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Plus Jakarta Sans for a clean digital-bank feel; IBM Plex Sans Thai covers Thai,
// which Jakarta lacks. The mono cut is only for log timestamps and action codes.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext", "vietnamese"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta", display: "swap" });
const plexThai = IBM_Plex_Sans_Thai({ subsets: ["thai"], weight: ["400", "500", "600", "700"], variable: "--font-plex-thai", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "WeXchange — Finance Agent for Exchange Students",
  description: "AI finance agent for international and exchange students: cross-border tuition payments, remittances, multi-currency budgets.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Light by default; a saved choice (light / dark / system) is applied before first paint.
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${jakarta.variable} ${plexThai.variable} ${plexMono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("go2china:theme");if(t==="dark"||t==="system")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
