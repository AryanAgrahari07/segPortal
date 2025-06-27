"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ColumnVisibilityManager } from "@/components/admin/column-visibility-manager"

export default function ColumnVisibilityPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* <div>
          <h1 className="text-3xl font-bold">Column Visibility</h1>
          <p className="text-muted-foreground">
            Manage which columns are visible to users in data tables and available for filtering
          </p>
        </div> */}
        
        <ColumnVisibilityManager />
      </div>
    </DashboardLayout>
  )
} 