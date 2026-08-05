import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Provider from "./provider";
import { ClientLayout } from "@/components/ClientLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "One Melody",
  description: "Your music, everywhere.",
  icons: {
    icon: "/image.png",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex h-screen bg-black text-white selection:bg-primary/30 overflow-hidden">
        <Provider>
          <ClientLayout>{children}</ClientLayout>
        </Provider>
      </body>
    </html>
  );
}
