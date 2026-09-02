import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PermissionsProvider } from "../lib/PermissionsProvider";
import { MediateursProvider } from "../lib/MediateursProvider";
import { ToastProvider } from "../components/ToastProvider";
import { ConfirmProvider } from "../components/ConfirmProvider";
import BugReportButton from "../components/BugReportButton";
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
  title: "COSMOS",
  description: "Plateforme C.O.S.M.O.S. — Colombbus Orchestrateur de Suivi, Médiation et Orientation Solidaire",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PermissionsProvider>
          <MediateursProvider>
            <ToastProvider>
              <ConfirmProvider>
                {children}
                <BugReportButton />
              </ConfirmProvider>
            </ToastProvider>
          </MediateursProvider>
        </PermissionsProvider>
      </body>
    </html>
  );
}
