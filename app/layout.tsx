import "@/app/globals.css";
import { Space_Grotesk } from "next/font/google";
import { ReactNode } from "react";
import { TopNav } from "@/app/components/TopNav";

const font = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk"
});

export const metadata = {
  title: "ColorGamut | ICC Gamut Proofing",
  description: "Analyze RGB images against printer ICC profiles and understand out-of-gamut risk."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <TopNav />
          {children}
        </div>
      </body>
    </html>
  );
}
