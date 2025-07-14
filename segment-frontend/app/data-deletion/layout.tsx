import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"

export default function DataDeletionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* <div> */}
            {/* <h1 className="text-3xl font-bold tracking-tight">Data Deletion Portal</h1>
            <p className="text-muted-foreground mt-2">
              Manage customer data deletion requests in compliance with privacy regulations.
            </p> */}
          {/* </div> */}
          <div >
            {children}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}