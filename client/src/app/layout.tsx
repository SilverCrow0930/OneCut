import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: "Lemona - The AI Video Editor",
  description: "The AI Video Editor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased ${poppins.className}`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
