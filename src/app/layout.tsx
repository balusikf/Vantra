import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import AccountProvider from '@/components/vantra/AccountProvider';
import AppChrome from '@/components/vantra/AppChrome';
import NookProvider from '@/components/nook/NookProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "VANTRA", template: "%s | VANTRA" },
  description: "Your private movie, TV and anime library.",
  robots: { index: false, follow: false },
};

// Keep the header and account identity outside the page transition boundary.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><AccountProvider><NookProvider><AppChrome />{children}</NookProvider></AccountProvider></body>
    </html>
  );
}
