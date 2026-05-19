import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { Navbar } from "@/components/layout/Navbar"
import { Toaster } from "react-hot-toast"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CONFIAHOGAR — Profesionales del hogar de confianza",
  description: "Encuentra fontaneros, electricistas, carpinteros y más en tu zona",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />
        </Providers>
      </body>
    </html>
  )
}
