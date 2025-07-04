"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useAuth } from "@/contexts/auth-context"
import { LogOut, Database, Users } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Database,
      show: true,
    },
    {
      name: "Admin Panel",
      href: "/admin",
      icon: Users,
      show: user?.role === "admin",
    },
  ]

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Header */}
      <header className="border-b border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50/80 to-indigo-50/80 dark:from-violet-950/80 dark:to-indigo-950/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="w-[100%] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">Segment Manager</h1>
              <nav className="flex space-x-4">
                {navigation.map((item) => {
                  if (!item.show) return null
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-gradient-to-r from-violet-600 to-indigo-500 text-white"
                          : "text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-100 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                      }`}
                    >
                      <item.icon className="h-4 w-4 mr-2" />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-violet-700 dark:text-violet-300">Welcome, {user?.first_name}</span>
              <ThemeToggle />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={logout}
                className="hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-300"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-[100%] mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
