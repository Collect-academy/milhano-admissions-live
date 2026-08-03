import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Milhano | Admissions",
  description:
    "Milhano admissions and pipeline dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
