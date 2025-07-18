"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { dataService } from "@/services/data-service"
import { Loader2, ArrowLeft, Filter, Play, Edit, Trash2, Power, Clock } from "lucide-react"
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
import { useAuth } from "@/contexts/auth-context"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { 
  calculateDateRangeFromPreset, 
  formatDateForDisplay, 
  getPresetDisplayText,
  formatDateForSQL,
  getDateRangeDisplayText,
  normalizeDatePreset
} from "@/lib/date-utils"

export default function SegmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const segmentId = params?.segmentId as string

  const [segment, setSegment] = useState<SegmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  // Function to process SQL with dynamic dates
  const processSQL = (sql: string, filterGroups: any[]): string => {
    if (!sql) return "No SQL generated";
    
    let processedSQL = sql;
    
    // Find all date filters with presets
    const dateFilters: any[] = [];
    filterGroups?.forEach(group => {
      group.filters?.forEach((filter: any) => {
        if (filter.date_preset && 
            (filter.column_data_type === 'date' || 
             filter.column_data_type === 'datetime' || 
             filter.column_data_type === 'timestamp')) {
          dateFilters.push(filter);
        }
      });
    });
    
    // Process each date filter
    dateFilters.forEach(filter => {
      // Normalize the date preset name
      const normalizedPreset = normalizeDatePreset(filter.date_preset);
      
      const { startDate, endDate } = calculateDateRangeFromPreset(normalizedPreset);
      if (!startDate || !endDate) return;
      
      const formattedStartDate = formatDateForSQL(startDate);
      const formattedEndDate = formatDateForSQL(endDate);
      
      // Replace dates in SQL based on filter operator
      if (filter.filter_operator === 'between') {
        // Create a pattern that will match the BETWEEN clause for this column
        // This handles various formats of the date in SQL
        const patternStr = `${filter.column_name}\\s+BETWEEN\\s+['"]?[^\\s'"]+'?\\s+AND\\s+['"]?[^\\s'"]+['"]?`;
        const pattern = new RegExp(patternStr, 'gi');
        
        // Replace with the dynamic dates
        processedSQL = processedSQL.replace(
          pattern, 
          `${filter.column_name} BETWEEN '${formattedStartDate}' AND '${formattedEndDate}'`
        );
      } else if (filter.filter_operator === 'greaterThanOrEqual' || filter.filter_operator === '>=') {
        // Replace >= clause with dynamic start date
        const pattern = new RegExp(`${filter.column_name}\\s*>=\\s*['"]?[^\\s'"]+['"]?`, 'gi');
        processedSQL = processedSQL.replace(
          pattern, 
          `${filter.column_name} >= '${formattedStartDate}'`
        );
      } else if (filter.filter_operator === 'lessThanOrEqual' || filter.filter_operator === '<=') {
        // Replace <= clause with dynamic end date
        const pattern = new RegExp(`${filter.column_name}\\s*<=\\s*['"]?[^\\s'"]+['"]?`, 'gi');
        processedSQL = processedSQL.replace(
          pattern, 
          `${filter.column_name} <= '${formattedEndDate}'`
        );
      }
    });
    
    return processedSQL;
  };

  // Check if the current user can manage this segment (creator or admin)
  const canManageSegment = user && segment && (user.email === segment.created_by || user.role === "admin")

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

  const toggleSegmentStatus = async () => {
    if (!segment) return
    
    try {
      setIsToggling(true)
      const newStatus = segment.status === 'active' ? 'disabled' : 'active'
      
      await dataService.toggleSegmentStatus(segmentId, newStatus)
      
      // Update local state
      setSegment({
        ...segment,
        status: newStatus
      })
      
      toast({
        title: "Success",
        description: `Segment ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${segment.status === 'active' ? 'deactivate' : 'activate'} segment`,
        variant: "destructive",
      })
    } finally {
      setIsToggling(false)
    }
  }

  const editSegment = () => {
    router.push(`/table/${segment?.segment_config?.target_table}?segment=${segmentId}`)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
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
                <Filter className="h-8 w-8 text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-md" />
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-lg font-medium bg-gradient-to-r from-violet-600 to-indigo-400 bg-clip-text text-transparent">Loading segment data...</p>
              <div className="flex justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-600 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></span>
              </div>
            </div>
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
            <Filter className="h-12 w-12 mx-auto mb-4 text-violet-500" />
            <h3 className="text-lg font-semibold mb-2 text-violet-900 dark:text-violet-100">Segment not found</h3>
            <p className="text-muted-foreground mb-4">The requested segment could not be found</p>
            <Button 
              onClick={() => router.push("/dashboard?tab=segments")}
              className="border-violet-400/30 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-300"
            >
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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push("/dashboard?tab=segments")}
              className="hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-300"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-400 bg-clip-text text-transparent flex items-center">
                <Filter className="h-8 w-8 mr-3 text-violet-600" />
                {segment.segment_name}
              </h1>
              <p className="text-muted-foreground">{segment.description || "No description provided"}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {canManageSegment && (
              <div className="flex items-center space-x-2 mr-4">
                <Switch
                  id="segment-status"
                  checked={segment.status === 'active'}
                  onCheckedChange={toggleSegmentStatus}
                  disabled={isToggling}
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-600 data-[state=checked]:to-indigo-500"
                />
                <Label htmlFor="segment-status" className="text-violet-700 dark:text-violet-300">
                  {segment.status === 'active' ? 'Active' : 'Disabled'}
                </Label>
              </div>
            )}
            <Button 
              variant="outline" 
              onClick={editSegment}
              className="border-violet-400/30 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-300"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Segment
            </Button>
            {/* <Button onClick={editSegment} >
               <Play className="h-4 w-4 mr-2" /> Execute Segment
            </Button> */}
            {canManageSegment && (
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteDialog(true)}
                className="bg-red-500 hover:bg-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Segment Details */}
          <Card className="border-violet-200 dark:border-violet-800">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border-b border-violet-100 dark:border-violet-800">
              <CardTitle className="text-violet-900 dark:text-violet-100">Segment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Target Table</h3>
                <p className="font-medium text-violet-700 dark:text-violet-300">{segment.segment_config?.target_table || "Unknown"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                <Badge 
                  variant={segment.status === "active" ? "default" : "secondary"}
                  className={segment.status === "active" 
                    ? "bg-gradient-to-r from-emerald-500 to-green-500" 
                    : "bg-gradient-to-r from-slate-400 to-gray-500"}
                >
                  {segment.status}
                </Badge>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Created By</h3>
                <p className="text-indigo-700 dark:text-indigo-300">{segment.created_by}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Created At</h3>
                <p>{new Date(segment.created_at).toLocaleString()}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Filter Summary</h3>
                <p className="text-violet-700 dark:text-violet-300">
                  {filterGroupCount} filter groups with {filterCount} total filters
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Filter Groups */}
          <Card className="md:col-span-2 border-violet-200 dark:border-violet-800">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border-b border-violet-100 dark:border-violet-800">
              <CardTitle className="text-violet-900 dark:text-violet-100">Filter Groups</CardTitle>
              <CardDescription>
                This segment contains {filterGroupCount} filter groups with {filterCount} total filters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {segment.filter_groups?.length > 0 ? (
                segment.filter_groups.map((group: any, index: number) => (
                  <div key={group.id || index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-violet-700 dark:text-violet-300">{group.group_name}</h3>
                      <div className="flex items-center gap-2">
                        {group.not && (
                          <Badge variant="destructive" className="bg-red-500">NOT</Badge>
                        )}
                        <Badge variant={group.not ? "outline" : "default"} className={group.not ? "border-violet-300 dark:border-violet-700" : "bg-gradient-to-r from-violet-600 to-indigo-500"}>
                          {group.group_condition}
                        </Badge>
                      </div>
                    </div>
                    <div className="border rounded-md p-4 space-y-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10">
                      {group.filters?.map((filter: any, filterIndex: number) => {
                        // Calculate dynamic dates for date presets
                        let displayValue = filter.filter_value;
                        let displayValue2 = filter.filter_value_2;
                        let isDynamic = false;
                        let normalizedPreset: any = null;
                        
                        // Check if this is a date filter with a preset
                        if (filter.date_preset && 
                            (filter.column_data_type === 'date' || 
                             filter.column_data_type === 'datetime' || 
                             filter.column_data_type === 'timestamp')) {
                          
                          // Normalize the date preset name
                          normalizedPreset = normalizeDatePreset(filter.date_preset);
                          
                          // Use dynamic dates from backend if available
                          if (filter.dynamic_start_date && filter.dynamic_end_date) {
                            displayValue = filter.dynamic_start_date;
                            displayValue2 = filter.dynamic_end_date;
                            isDynamic = true;
                          } else {
                            // Calculate current date range based on preset as fallback
                            const { startDate, endDate } = calculateDateRangeFromPreset(normalizedPreset);
                            
                            if (startDate && endDate) {
                              displayValue = formatDateForDisplay(startDate);
                              displayValue2 = formatDateForDisplay(endDate);
                              isDynamic = true;
                            }
                          }
                        }
                        
                        return (
                          <div key={filter.id || filterIndex} className="text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-violet-700 dark:text-violet-300">{filter.column_name}</span>
                              <span className="text-muted-foreground">{filter.column_data_type}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300">
                                {filter.filter_operator}
                              </Badge>
                              
                              {isDynamic ? (
                                <div className="flex flex-col">
                                  <div className="flex items-center">
                                    <Badge className="bg-violet-500 hover:bg-violet-600">
                                      {getPresetDisplayText(normalizedPreset)}
                                    </Badge>
                                    <Badge variant="outline" className="ml-2 text-xs bg-violet-100 dark:bg-violet-900/30">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Dynamic
                                    </Badge>
                                  </div>
                                  <span className="text-xs text-muted-foreground italic mt-1">
                                    Currently: {displayValue} {filter.filter_operator === 'between' ? `to ${displayValue2}` : ''}
                                  </span>
                                </div>
                              ) : (
                                <span>
                                  {Array.isArray(filter.filter_value) 
                                    ? filter.filter_value.join(', ')
                                    : displayValue}
                                  {displayValue2 && filter.filter_operator === 'between' && (
                                    <>
                                      <span> to </span>
                                      <span>{displayValue2}</span>
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                            {filterIndex < group.filters.length - 1 && (
                              <div className="flex items-center justify-center py-1">
                                <Badge variant="secondary" className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                                  {group.group_condition}
                                </Badge>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {index < segment.filter_groups.length - 1 && (
                      <div className="flex items-center justify-center py-2">
                        <Badge variant="outline" className="border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300">
                          {segment.groupConditions && segment.groupConditions[index] 
                            ? segment.groupConditions[index]
                            : (segment.filter_groups[index + 1] as any)?.between_group_condition || "AND"}
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

          {/* Dynamic Date Information Section */}
          {/* {segment.filter_groups?.some(group => 
            group.filters?.some(filter => filter.date_preset)
          ) && (
            <Card className="md:col-span-3 border-violet-200 dark:border-violet-800 mt-4">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border-b border-violet-100 dark:border-violet-800">
                <CardTitle className="text-violet-900 dark:text-violet-100">
                  <Clock className="h-5 w-5 inline-block mr-2" />
                  Dynamic Date Information
                </CardTitle>
                <CardDescription>
                  This segment contains dynamic date filters that update automatically
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {segment.filter_groups?.map((group, groupIndex) => (
                    group.filters?.some(filter => filter.date_preset) && (
                      <div key={groupIndex} className="space-y-2">
                        <h3 className="font-medium text-violet-700 dark:text-violet-300">{group.group_name}</h3>
                        <div className="border rounded-md p-4 space-y-3 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10">
                          {group.filters?.filter(filter => filter.date_preset).map((filter, filterIndex) => {
                            const { startDate, endDate } = calculateDateRangeFromPreset(filter.date_preset as any);
                            return (
                              <div key={filterIndex} className="flex justify-between items-start">
                                <div>
                                  <span className="font-medium text-violet-700 dark:text-violet-300">
                                    {filter.column_name}
                                  </span>
                                  <Badge className="ml-2 bg-gradient-to-r from-violet-600 to-indigo-500">
                                    {getPresetDisplayText(filter.date_preset as any)}
                                  </Badge>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Filter will always use the most recent date range
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium">Current values:</div>
                                  <div className="text-sm">
                                    {startDate && formatDateForDisplay(startDate)}
                                    {filter.filter_operator === 'between' && endDate && (
                                      <> to {formatDateForDisplay(endDate)}</>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </CardContent>
            </Card>
          )} */}

          {/* SQL Preview */}
          <Card className="md:col-span-3 border-violet-200 dark:border-violet-800">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border-b border-violet-100 dark:border-violet-800">
              <CardTitle className="text-violet-900 dark:text-violet-100">Generated SQL</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-indigo-500"></div>
                <pre className="bg-violet-50/50 dark:bg-violet-900/10 p-4 pl-6 rounded-md overflow-x-auto text-sm border border-violet-100 dark:border-violet-800/30 font-medium">
                  {segment.filter_groups?.some(group => 
                    group.filters?.some(filter => filter.date_preset)
                  ) ? processSQL(segment.generated_sql, segment.filter_groups) : segment.generated_sql || "No SQL generated"}
                </pre>
                {segment.filter_groups?.some(group => 
                  group.filters?.some(filter => filter.date_preset)
                ) && (
                  <div className="mt-2 text-xs text-muted-foreground italic flex items-center">
                    <Clock className="h-3 w-3 mr-1 text-violet-500" />
                    <span>This SQL includes dynamic date values based on current date</span>
                  </div>
                )}
              </div>
            </CardContent>
            {segment.custom_sql && (
              <>
                <Separator className="bg-violet-200 dark:bg-violet-800" />
                <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border-b border-violet-100 dark:border-violet-800">
                  <CardTitle className="text-violet-900 dark:text-violet-100">Custom SQL</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <pre className="bg-violet-50/50 dark:bg-violet-900/10 p-4 rounded-md overflow-x-auto text-sm border border-violet-100 dark:border-violet-800/30">{segment.custom_sql}</pre>
                </CardContent>
              </>
            )}
          </Card>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-gradient-to-br from-white to-violet-50 dark:from-gray-950 dark:to-violet-950/30 border-violet-200 dark:border-violet-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-violet-900 dark:text-violet-100">Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete the segment &quot;{segment.segment_name}&quot;. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-violet-300 dark:border-violet-700">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteSegment}
                disabled={deleting}
                className="bg-red-500 hover:bg-red-600 text-white"
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
