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
