import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import OfflineServiceWorker from "@/components/OfflineServiceWorker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ePoster | Scientific Research Gallery",
  description: "Submit, discover, and preview scientific research posters.",
  applicationName: "ePoster",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ePoster",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <OfflineServiceWorker />
        {children}
      </body>
    </html>
  );
}
