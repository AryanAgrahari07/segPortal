import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Users } from "lucide-react"

export default function AdminLoading() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-10 w-48 bg-gradient-to-r from-violet-200 to-indigo-200 dark:from-violet-900/40 dark:to-indigo-900/40 rounded-lg animate-pulse"></div>
            <div className="h-4 w-64 bg-violet-100 dark:bg-violet-900/30 rounded mt-2 animate-pulse"></div>
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-40 bg-gradient-to-r from-violet-300 to-indigo-300 dark:from-violet-800/40 dark:to-indigo-800/40 rounded-md animate-pulse"></div>
            <div className="h-10 w-32 bg-gradient-to-r from-violet-300 to-indigo-300 dark:from-violet-800/40 dark:to-indigo-800/40 rounded-md animate-pulse"></div>
          </div>
        </div>

        {/* Search skeleton */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-sm">
            <div className="h-10 w-full bg-violet-100 dark:bg-violet-900/30 rounded-md animate-pulse"></div>
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="border border-violet-200 dark:border-violet-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40">
            <div className="h-6 w-32 bg-violet-200 dark:bg-violet-800/60 rounded animate-pulse"></div>
            <div className="h-4 w-48 bg-violet-100 dark:bg-violet-900/40 rounded mt-2 animate-pulse"></div>
          </div>
          
          <div className="p-4 space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="border border-violet-100 dark:border-violet-900/30 rounded-lg p-6 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-200 to-indigo-200 dark:from-violet-800/40 dark:to-indigo-800/40 rounded-full"></div>
                    <div>
                      <div className="h-5 w-32 bg-violet-200 dark:bg-violet-800/60 rounded"></div>
                      <div className="h-4 w-48 bg-violet-100 dark:bg-violet-900/40 rounded mt-2"></div>
                      <div className="h-4 w-40 bg-violet-100 dark:bg-violet-900/40 rounded mt-1"></div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="h-6 w-16 bg-gradient-to-r from-violet-300 to-indigo-300 dark:from-violet-800/40 dark:to-indigo-800/40 rounded-full"></div>
                    <div className="h-6 w-16 bg-gradient-to-r from-violet-300 to-indigo-300 dark:from-violet-800/40 dark:to-indigo-800/40 rounded-full"></div>
                    <div className="h-8 w-8 bg-violet-100 dark:bg-violet-900/30 rounded-md"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination skeleton */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pb-2">
          <div className="h-4 w-48 bg-violet-100 dark:bg-violet-900/30 rounded animate-pulse"></div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-28 bg-violet-100 dark:bg-violet-900/30 rounded animate-pulse"></div>
            <div className="flex gap-1">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-8 w-8 bg-violet-100 dark:bg-violet-900/30 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Centered loading indicator */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-6">
            <div className="relative">
              <div className="w-24 h-24 mx-auto relative">
                {/* Outer ring animation */}
                <div className="absolute inset-0 rounded-full border-8 border-violet-200 dark:border-violet-800/40"></div>
                <div className="absolute inset-0 rounded-full border-8 border-transparent border-t-violet-600 dark:border-t-violet-400 animate-spin"></div>
                
                {/* Middle ring animation - opposite direction */}
                <div className="absolute inset-2 rounded-full border-6 border-violet-100 dark:border-violet-900/30"></div>
                <div className="absolute inset-2 rounded-full border-6 border-transparent border-b-indigo-500 dark:border-b-indigo-400 animate-spin animate-duration-[1.5s] animate-reverse"></div>
                
                {/* Inner pulsing circle */}
                <div className="absolute inset-5 rounded-full bg-gradient-to-br from-violet-600 to-indigo-500 animate-pulse"></div>
                
                {/* Icon */}
                <Users className="h-8 w-8 text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-md" />
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-lg font-medium bg-gradient-to-r from-violet-600 to-indigo-400 bg-clip-text text-transparent">Loading user data...</p>
              <div className="flex justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-600 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
