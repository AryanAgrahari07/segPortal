"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { dataService } from "@/services/data-service"
import { Loader2, ArrowLeft, Filter, Play, Edit, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SegmentData } from "@/services/data-service"

export default function SegmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const segmentId = params?.segmentId as string

  const [segment, setSegment] = useState<SegmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEffect(() => {
    loadSegmentData()
  }, [segmentId])

  const loadSegmentData = async () => {
    try {
      setLoading(true)
      const segmentData = await dataService.getSegmentById(segmentId, ["filter_groups", "filters"])
      setSegment(segmentData.data)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load segment",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // const executeSegment = async () => {
  //   try {
  //     setExecuting(true)
  //     await dataService.executeSegment(segmentId, { save_results: true })
  //     await dataService.updateLastExecuted(segmentId)

  //     toast({
  //       title: "Success",
  //       description: "Segment executed successfully",
  //     })

  //     // Reload segment data to get updated last_executed
  //     loadSegmentData()
  //   } catch (error: any) {
  //     toast({
  //       title: "Error",
  //       description: error.message || "Failed to execute segment",
  //       variant: "destructive",
  //     })
  //   } finally {
  //     setExecuting(false)
  //   }
  // }

  const deleteSegment = async () => {
    try {
      setDeleting(true)
      await dataService.deleteSegment(segmentId)

      toast({
        title: "Success",
        description: "Segment deleted successfully",
      })

      router.push("/dashboard?tab=segments")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete segment",
        variant: "destructive",
      })
      setDeleting(false)
    }
  }

  const editSegment = () => {
    router.push(`/table/${segment?.segment_config?.target_table}?segment=${segmentId}`)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
            <p>Loading segment data...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!segment) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Segment not found</h3>
            <p className="text-muted-foreground mb-4">The requested segment could not be found</p>
            <Button onClick={() => router.push("/dashboard?tab=segments")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Segments
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const filterGroupCount = segment.filter_groups?.length || 0
  const filterCount =
    segment.filter_groups?.reduce((sum: number, group: any) => sum + (group.filters?.length || 0), 0) || 0

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard?tab=segments")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center">
                <Filter className="h-8 w-8 mr-3 text-primary" />
                {segment.segment_name}
              </h1>
              <p className="text-muted-foreground">{segment.description || "No description provided"}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={editSegment}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Segment
            </Button>
            <Button onClick={editSegment} >
               <Play className="h-4 w-4 mr-2" /> Execute Segment
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Segment Details */}
          <Card>
            <CardHeader>
              <CardTitle>Segment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Target Table</h3>
                <p className="font-medium">{segment.segment_config?.target_table || "Unknown"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                <Badge variant={segment.status === "active" ? "default" : "secondary"}>{segment.status}</Badge>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Created By</h3>
                <p>{segment.created_by}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Created At</h3>
                <p>{new Date(segment.created_at).toLocaleString()}</p>
              </div>
              {segment.last_executed && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Last Executed</h3>
                  <p>{new Date(segment.last_executed).toLocaleString()}</p>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Filter Summary</h3>
                <p>
                  {filterGroupCount} filter groups with {filterCount} total filters
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Filter Groups */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Filter Groups</CardTitle>
              <CardDescription>
                This segment contains {filterGroupCount} filter groups with {filterCount} total filters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {segment.filter_groups?.length > 0 ? (
                segment.filter_groups.map((group: any, index: number) => (
                  <div key={group.id || index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{group.group_name}</h3>
                      <div className="flex items-center gap-2">
                        {group.not && (
                          <Badge variant="destructive">NOT</Badge>
                        )}
                        <Badge variant={group.not ? "outline" : "default"}>
                          {group.group_condition}
                        </Badge>
                      </div>
                    </div>
                    <div className="border rounded-md p-4 space-y-2">
                      {group.filters?.length > 0 ? (
                        group.filters.map((filter: any, filterIndex: number) => (
                          <div key={filter.id || filterIndex} className="text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{filter.column_name}</span>
                              <span className="text-muted-foreground">{filter.column_data_type}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">{filter.filter_operator}</Badge>
                              <span>
                                {Array.isArray(filter.filter_value) 
                                  ? filter.filter_value.join(', ')
                                  : filter.filter_value}
                              </span>
                              {filter.filter_value_2 && (
                                <>
                                  <span>to</span>
                                  <span>{filter.filter_value_2}</span>
                                </>
                              )}
                            </div>
                            {filterIndex < group.filters.length - 1 && (
                              <div className="flex items-center justify-center py-1">
                                <Badge variant="secondary" className="text-xs">
                                  {group.group_condition}
                                </Badge>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No filters in this group</p>
                      )}
                    </div>
                    {index < segment.filter_groups.length - 1 && (
                      <div className="flex items-center justify-center py-2">
                        <Badge variant="outline">
                          {segment.segment_config && (segment.segment_config as any).groupConditions?.[index] || 
                           group.between_group_condition || 
                           "AND"}
                        </Badge>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No filter groups defined for this segment</p>
              )}
            </CardContent>
          </Card>

          {/* SQL Preview */}
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>Generated SQL</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                {segment.generated_sql || "No SQL generated"}
              </pre>
            </CardContent>
            {segment.custom_sql && (
              <>
                <Separator />
                <CardHeader>
                  <CardTitle>Custom SQL</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">{segment.custom_sql}</pre>
                </CardContent>
              </>
            )}
          </Card>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the segment &quot;{segment.segment_name}&quot;. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteSegment}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground"
              >
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  )
}
