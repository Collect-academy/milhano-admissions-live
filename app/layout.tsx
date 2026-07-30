import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Milhano | Admisiones",
  description: "Dashboard de admisiones y pipeline de Milhano",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
