import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/index.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingAudioPlayer from "@/components/FloatingAudioPlayer";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MovieChatterbox — Discover, Rate & Discuss Movies",
  description: "Your place to discover, rate & chat about movies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <Toaster />
          <div className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
            <FloatingAudioPlayer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
