/**
 * FILE: layout.js
 * PURPOSE: Root layout - dark theme, fonts, metadata, AuthProvider,
 *          PWA manifest, service worker registration, OfflineBanner.
 */

import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from '@/context/AuthContext';
import OfflineBanner from '@/components/common/OfflineBanner';
import ServiceWorkerRegistrar from '@/components/common/ServiceWorkerRegistrar';
import ErrorBoundary from '@/components/common/ErrorBoundary';

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata = {
  title: "Rakshak - Multi-Disaster Prediction & Alert System",
  description: "Real-time earthquake, flood, landslide, and cyclone prediction with automated voice call alerts in Hindi and regional Indian languages.",
  keywords: "disaster, prediction, flood, earthquake, landslide, cyclone, India, alert, voice call",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rakshak",
  },
};

export const viewport = {
  themeColor: "#1B3676",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3B82F6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0F172A] text-[#F8FAFC] min-h-screen`}
      >
        <AuthProvider>
          <ErrorBoundary>
            <ServiceWorkerRegistrar />
          </ErrorBoundary>
          {children}
          <ErrorBoundary fallback={null}>
            <OfflineBanner />
          </ErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
