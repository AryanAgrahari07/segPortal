"use client"

import { ProtectedRoute } from "@/components/protected-route"

export default function TableLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute allowedRoles={["admin", "user"]}>
      {children}
    </ProtectedRoute>
  )
} 