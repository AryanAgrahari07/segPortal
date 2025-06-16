"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "@/hooks/use-toast"

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export function ProtectedRoute({ children, allowedRoles = [] }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      // If user is not authenticated, redirect to login
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to access this page",
          variant: "destructive",
        })
        router.push("/login")
        return
      }

      // If roles are specified and user doesn't have the required role
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        toast({
          title: "Unauthorized Access",
          description: "You don't have permission to access this page",
          variant: "destructive",
        })
        
        // Redirect admin to admin page, others to dashboard
        if (user.role === "admin") {
          router.push("/admin")
        } else {
          router.push("/dashboard")
        }
      }
    }
  }, [user, loading, router, allowedRoles])

  // Show nothing while loading or redirecting
  if (loading || !user || (allowedRoles.length > 0 && !allowedRoles.includes(user.role))) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-b-2 border-t-2 border-purple-500"></div>
      </div>
    )
  }

  // If authenticated and authorized, render children
  return <>{children}</>
} 