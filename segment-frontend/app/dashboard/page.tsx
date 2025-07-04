"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Database, Filter, Search, Calendar, User, Play, ChevronLeft, ChevronRight, Plus, Sparkles, BarChart } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { dataService } from "@/services/data-service"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface Table {
  tableName: string
  database: string
  isTemporary: boolean
}

interface Segment {
  segment_id: string
  segment_name: string
  description?: string
  created_by: string
  status: string
  created_at: string
  last_executed?: string
}

interface PaginationState {
  currentPage: number
  pageSize: number
}

export default function DashboardPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTables, setLoadingTables] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [segmentsPagination, setSegmentsPagination] = useState<PaginationState>({ currentPage: 1, pageSize: 10 })
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedTable, setSelectedTable] = useState<string>("")
  const { toast } = useToast()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const defaultTab = searchParams?.get("tab") || "segments"

  useEffect(() => {
    loadSegmentsData()
  }, [])

  // Handle dialog open/close
  const handleDialogOpenChange = (open: boolean) => {
    setShowCreateDialog(open)
    
    // Reset selected table when dialog is closed
    if (!open) {
      setSelectedTable("")
    } else {
      // Load tables data when dialog is opened
      loadTablesData()
    }
  }

  const loadSegmentsData = async () => {
    try {
      setLoading(true)

      // Load segments - using the optimized summary endpoint
      try {
        const segmentsData = await dataService.getDashboardSegments()
        
        if (segmentsData && segmentsData.success && Array.isArray(segmentsData.data)) {
          setSegments(segmentsData.data)
        } else {
          console.error("No valid segments data structure found:", segmentsData)
        }
      } catch (segmentError) {
        console.error("Error loading segments:", segmentError)
        setSegments([])
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load segments data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadTablesData = async () => {
    try {
      setLoadingTables(true)

      const tablesData = await dataService.getAllTables()

      if (tablesData && Array.isArray(tablesData.tables)) {
        setTables(tablesData.tables)
      } else if (tablesData && Array.isArray(tablesData)) {
        setTables(tablesData)
      } else if (tablesData && (tablesData as any).data && Array.isArray((tablesData as any).data)) {
        setTables((tablesData as any).data)
      } else {
        console.error("No valid tables data structure found:", tablesData)
        setTables([])
      }
    } catch (tableError) {
      console.error("Error loading tables:", tableError)
      setTables([])
      toast({
        title: "Error",
        description: "Failed to load tables data",
        variant: "destructive",
      })
    } finally {
      setLoadingTables(false)
    }
  }

  // Filter segments by search term
  const filteredSegments = useMemo(() => {
    return segments.filter((segment) =>
      segment.segment_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (segment.description && segment.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [segments, searchTerm])


  // Calculate paginated data for segments
  const paginatedSegments = useMemo(() => {
    const startIndex = (segmentsPagination.currentPage - 1) * segmentsPagination.pageSize
    const endIndex = startIndex + segmentsPagination.pageSize
    return filteredSegments.slice(startIndex, endIndex)
  }, [filteredSegments, segmentsPagination])


  // Calculate total pages for segments
  const totalSegmentsPages = useMemo(() => {
    return Math.ceil(filteredSegments.length / segmentsPagination.pageSize)
  }, [filteredSegments, segmentsPagination.pageSize])


  // Handle page change for segments
  const handleSegmentsPageChange = (page: number) => {
    setSegmentsPagination((prev) => ({ ...prev, currentPage: page }))
  }

  // Handle page size change for segments
  const handleSegmentsPageSizeChange = (size: number) => {
    setSegmentsPagination({ currentPage: 1, pageSize: size })
  }


  // Render pagination controls for segments
  const renderSegmentsPagination = () => {
    const { currentPage, pageSize } = segmentsPagination
    const startRecord = ((currentPage - 1) * pageSize) + 1
    const endRecord = Math.min(currentPage * pageSize, filteredSegments.length)
    
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pb-2">
        <div className="text-sm">
          Showing <span className="font-medium text-violet-700 dark:text-violet-400">{startRecord}-{endRecord}</span> of <span className="font-medium text-violet-700 dark:text-violet-400">{filteredSegments.length}</span> segments
        </div>
        <div className="flex items-center gap-2">
          <Select 
            value={pageSize.toString()} 
            onValueChange={(value) => handleSegmentsPageSizeChange(parseInt(value))}
          >
            <SelectTrigger className="w-[110px] h-8 border-violet-400/30 focus-visible:ring-violet-500/30">
              <SelectValue placeholder="Rows per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 per page</SelectItem>
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="20">20 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
            </SelectContent>
          </Select>
          
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => handleSegmentsPageChange(currentPage - 1)}
                  className={cn(
                    currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer",
                    "hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300"
                  )}
                />
              </PaginationItem>
              
              {/* First page */}
              {currentPage > 2 && (
                <PaginationItem>
                  <PaginationLink 
                    onClick={() => handleSegmentsPageChange(1)}
                    className="hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300"
                  >
                    1
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {/* Ellipsis */}
              {currentPage > 3 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              
              {/* Previous page */}
              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationLink 
                    onClick={() => handleSegmentsPageChange(currentPage - 1)}
                    className="hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300"
                  >
                    {currentPage - 1}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {/* Current page */}
              <PaginationItem>
                <PaginationLink 
                  isActive 
                  className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600"
                >
                  {currentPage}
                </PaginationLink>
              </PaginationItem>
              
              {/* Next page */}
              {currentPage < totalSegmentsPages && (
                <PaginationItem>
                  <PaginationLink 
                    onClick={() => handleSegmentsPageChange(currentPage + 1)}
                    className="hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300"
                  >
                    {currentPage + 1}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {/* Ellipsis */}
              {currentPage < totalSegmentsPages - 2 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              
              {/* Last page */}
              {currentPage < totalSegmentsPages - 1 && totalSegmentsPages > 1 && (
                <PaginationItem>
                  <PaginationLink 
                    onClick={() => handleSegmentsPageChange(totalSegmentsPages)}
                    className="hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300"
                  >
                    {totalSegmentsPages}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => handleSegmentsPageChange(currentPage + 1)}
                  className={cn(
                    currentPage >= totalSegmentsPages ? "pointer-events-none opacity-50" : "cursor-pointer",
                    "hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300"
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    )
  }

  const handleCreateSegment = () => {
    if (!selectedTable) {
      toast({
        title: "Error",
        description: "Please select a table first",
        variant: "destructive",
      })
      return
    }
    
    router.push(`/table/${selectedTable}`)
    setShowCreateDialog(false)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 bg-gradient-to-tr from-violet-600 to-indigo-400 rounded-full animate-pulse opacity-50"></div>
              <Loader2 className="h-16 w-16 animate-spin text-violet-600 absolute inset-0" />
            </div>
            <p className="text-lg font-medium bg-gradient-to-r from-violet-600 to-indigo-400 bg-clip-text text-transparent">Loading your segments...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h5 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-400 bg-clip-text text-transparent">
              Welcome, {user?.first_name}
            </h5>
            <p className="text-muted-foreground mt-1">Manage your segments and data filters</p>
          </div>
        </div>

        <div className="relative flex items-center justify-between space-x-4 mb-6">
          <div className="relative max-w-sm">
            <div className="absolute left-3 top-3 h-4 w-4 text-violet-500">
              <Search className="h-4 w-4" />
            </div>
            <Input
              placeholder="Search segments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-violet-400/30 focus-visible:ring-violet-500/30 bg-violet-50/50 dark:bg-violet-900/10"
            />
          </div>
          <Button 
            onClick={() => handleDialogOpenChange(true)} 
            className="flex items-center gap-1 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white"
          >
            <Plus className="h-4 w-4" />
            Create Segment
          </Button>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsContent value="segments" className="space-y-4">
            {filteredSegments.length > 0 ? (
              <Card className="border-violet-200 dark:border-violet-800 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border-b border-violet-100 dark:border-violet-800">
                  <div>
                    <CardTitle className="text-violet-900 dark:text-violet-100">Segments</CardTitle>
                    <CardDescription className="mt-1.5">Manage your data segments and filters</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-violet-50/50 dark:bg-violet-900/20">
                      <TableRow className="hover:bg-violet-100/50 dark:hover:bg-violet-800/30">
                        <TableHead className="text-violet-900 dark:text-violet-200">Name</TableHead>
                        <TableHead className="text-violet-900 dark:text-violet-200">Description</TableHead>
                        <TableHead className="text-violet-900 dark:text-violet-200">Created By</TableHead>
                        <TableHead className="text-violet-900 dark:text-violet-200">Status</TableHead>
                        <TableHead className="text-violet-900 dark:text-violet-200">Created</TableHead>
                        <TableHead className="text-violet-900 dark:text-violet-200">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSegments.map((segment) => (
                        <TableRow 
                          key={segment.segment_id || `segment-${Math.random()}`}
                          className="hover:bg-violet-50 dark:hover:bg-violet-900/10 border-b border-violet-100 dark:border-violet-800/30"
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-2">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white">
                                <Filter className="h-4 w-4" />
                              </div>
                              <span className="text-violet-900 dark:text-violet-100">{segment.segment_name || "Unnamed Segment"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <span className="text-sm text-muted-foreground">
                              {segment.description || "Custom data segment with filters"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm">
                              <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mr-2">
                                <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <span className="text-indigo-700 dark:text-indigo-300">{segment.created_by || "Unknown"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={segment.status === "active" ? "default" : "secondary"}
                              className={segment.status === "active" 
                                ? "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600" 
                                : "bg-gradient-to-r from-slate-400 to-gray-500"}
                            >
                              {segment.status || "unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <div className="h-6 w-6 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-2">
                                <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              </div>
                              {segment.created_at ? new Date(segment.created_at).toLocaleDateString() : "Unknown date"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link href={`/segment/${segment.segment_id}`}>
                              <Badge 
                                variant="outline" 
                                className="cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300"
                              >
                                <Play className="h-3 w-3 mr-1" /> View
                              </Badge>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {filteredSegments.length > 0 && (
                    <div className="p-4 border-t border-violet-100 dark:border-violet-800/30 bg-gradient-to-r from-violet-50/50 to-indigo-50/50 dark:from-violet-950/20 dark:to-indigo-950/20">
                      {renderSegmentsPagination()}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-16 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 rounded-lg border border-violet-200 dark:border-violet-800">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                  <Filter className="h-10 w-10 text-violet-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-violet-900 dark:text-violet-100">No segments found</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {searchTerm ? "Try adjusting your search terms." : "No segments have been created yet."}
                </p>
              </div>
            )}

            {/* Create Segment Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={handleDialogOpenChange}>
              <DialogContent className="bg-gradient-to-br from-white to-violet-50 dark:from-gray-950 dark:to-violet-950/30 border-violet-200 dark:border-violet-800 sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-violet-900 dark:text-violet-100 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white">
                      <Plus className="h-4 w-4" />
                    </div>
                    Create New Segment
                  </DialogTitle>
                  <DialogDescription>
                    Select a table to create a new segment with filters.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="table-select" className="text-right text-violet-700 dark:text-violet-300">
                      Table
                    </Label>
                    {loadingTables ? (
                      <div className="col-span-3 flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                        <span className="text-sm text-muted-foreground">Loading tables...</span>
                      </div>
                    ) : (
                      <Select
                        value={selectedTable}
                        onValueChange={setSelectedTable}
                      >
                        <SelectTrigger className="col-span-3 border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30">
                          <SelectValue placeholder="Select a table" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px] overflow-y-auto">
                          {tables.map((table) => (
                            <SelectItem key={table.tableName} value={table.tableName}>
                              <div className="flex items-center">
                                <Database className="h-3.5 w-3.5 mr-2 text-violet-500" />
                                {table.tableName}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="border-violet-300 dark:border-violet-700">
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateSegment} 
                    disabled={loadingTables || !selectedTable}
                    className="bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white"
                  >
                    Continue
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
