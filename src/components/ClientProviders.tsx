"use client"

import React from "react"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
      <Toaster richColors position="top-right" closeButton />
    </ThemeProvider>
  )
}