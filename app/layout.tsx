import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Milhano | Admissions",
  description:
    "Milhano admissions and pipeline dashboard",
};

const appearanceBootstrap = `
(function () {
  try {
    var root = document.documentElement;
    var theme = localStorage.getItem('milhano-theme');
    var fontSize = localStorage.getItem('milhano-font-size');
    if (!['light', 'balanced', 'dark'].includes(theme)) theme = 'light';
    if (!['small', 'medium', 'large'].includes(fontSize)) fontSize = 'small';
    root.dataset.theme = theme;
    root.dataset.fontSize = fontSize;
  } catch (error) {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.dataset.fontSize = 'small';
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-font-size="small" data-theme="light" lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
