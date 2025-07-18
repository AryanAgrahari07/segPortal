"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DataDeletionForm from "./components/data-deletion-form"

export default function DataDeletionPage() {
  const { user } = useAuth()
  const router = useRouter()

  // Redirect admin users to the admin section if they directly access /data-deletion
  useEffect(() => {
    if (user?.role === "admin") {
      router.push("/data-deletion/admin")
    }
  }, [user, router])

  // If the user is an admin, don't render the form
  if (user?.role === "admin") {
    return null // The useEffect will handle redirection
  }

  return (
    <div className="space-y-6">
      <Card className="border-violet-200 dark:border-violet-800 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border-b border-violet-200 dark:border-violet-800">
          <CardTitle className="text-violet-900 dark:text-violet-100">Create DSR Request</CardTitle>
          <CardDescription>
            Enter the details of the customer who has requested data deletion.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <DataDeletionForm />
        </CardContent>
      </Card>
    </div>
  )
} 