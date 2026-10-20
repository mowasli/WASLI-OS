import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "WASLI OS — Your executive workspace",
  description:
    "A private operating system for focused work across your worlds.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
