import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import Provider from "./provider";
import { ClientLayout } from "@/components/ClientLayout";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-spotify",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "One Melody",
  title: {
    default: "One Melody",
    template: "%s - One Melody",
  },
  description: "Stream in lossless clarity. Every beat, everywhere.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "One Melody",
  },
  icons: {
    icon: "/image.png",
    apple: [{ url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    shortcut: "/image.png",
  },
};

console.log("[Layout] 🧬 RootLayout module loaded");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  console.log("[Layout] 🏗️ Rendering RootLayout shell");
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex h-screen bg-black text-white selection:bg-primary/30 overflow-hidden font-sans">
        <Provider>
          <ClientLayout>{children}</ClientLayout>
        </Provider>
      </body>
    </html>
  );
}
