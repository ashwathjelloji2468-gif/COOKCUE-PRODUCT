import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { DemoTourPanel } from "@/components/founder/DemoTourPanel";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CookCue - The right amount. At the right time.",
  description: "CookCue: The right amount. At the right time. Intelligence in every meal.",
  icons: {
    icon: "/cookcue-logo.png",
    shortcut: "/cookcue-logo.png",
    apple: "/cookcue-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="cookcue-theme" disableTransitionOnChange>
          {children}
          <DemoTourPanel />
        </ThemeProvider>
      </body>
    </html>
  );
}
