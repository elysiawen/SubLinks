import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AccessLogger from '@/components/AccessLogger';
import ProgressBar from '@/components/ProgressBar';
import { ToastProvider } from '@/components/ToastProvider';
import { ConfirmProvider } from '@/components/ConfirmProvider';
import { Suspense } from 'react';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SubLinks - 订阅管理系统",
  description: "强大的订阅链接管理与分发系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          <ConfirmProvider>
            <AccessLogger />
            <Suspense fallback={null}>
              <ProgressBar />
            </Suspense>
            {children}
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html >
  );
}
