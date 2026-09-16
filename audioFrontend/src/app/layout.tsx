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
      <head>
        {/* Preconnect & DNS-Prefetch for instantaneous audio, video & cover artwork streaming */}
        <link rel="preconnect" href="https://ik.imagekit.io" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://ik.imagekit.io" />
        <link rel="preconnect" href="https://d2je6vsnsi1pie.cloudfront.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://d2je6vsnsi1pie.cloudfront.net" />
        <link rel="preconnect" href="https://audiomelodyspringboot.s3.ap-south-1.amazonaws.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://audiomelodyspringboot.s3.ap-south-1.amazonaws.com" />
        <link rel="preconnect" href="https://api.one-org.me" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.one-org.me" />
      </head>
      <body className="min-h-full flex h-screen bg-black text-white selection:bg-primary/30 overflow-hidden font-sans">
        <Provider>
          <ClientLayout>{children}</ClientLayout>
        </Provider>
      </body>
    </html>
  );
}
