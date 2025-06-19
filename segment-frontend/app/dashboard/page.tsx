"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Database, Filter, Search, Calendar, User, Play, ChevronLeft, ChevronRight, Plus } from "lucide-react"
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
  const [searchTerm, setSearchTerm] = useState("")
  const [tablesPagination, setTablesPagination] = useState<PaginationState>({ currentPage: 1, pageSize: 10 })
  const [segmentsPagination, setSegmentsPagination] = useState<PaginationState>({ currentPage: 1, pageSize: 10 })
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedTable, setSelectedTable] = useState<string>("")
  const { toast } = useToast()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const defaultTab = searchParams?.get("tab") || "segments"

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load tables
      try {
        const tablesData = await dataService.getAllTables()
        console.log("Tables API Response:", tablesData)

        if (Array.isArray(tablesData)) {
          setTables(tablesData)
        } else if (tablesData && Array.isArray(tablesData.data)) {
          // Handle case where API returns { success: true, data: [...] }
          setTables(tablesData.data)
        } else {
          console.error("Unexpected table data format:", tablesData)
          setTables([])
        }

        if (tablesData && Array.isArray(tablesData.tables)) {
          console.log("Setting tables from tablesData.table:", tablesData.tables)
          setTables(tablesData.tables)
        } else if (tablesData && Array.isArray(tablesData)) {
          console.log("Setting segments from direct array:", tablesData)
          setTables(tablesData)
        } else if (tablesData && (tablesData as any).data && Array.isArray((tablesData as any).data)) {
          console.log("Setting tables from tablesData.data:", (tablesData as any).data)
          setTables((tablesData as any).data)
        } else {
          console.error("No valid tables data structure found:", tablesData)
        }
      } catch (tableError) {
        console.error("Error loading tables:", tableError)
        setTables([])
      }

      // Load segments
      try {
        const segmentsData = await dataService.getAllSegments()
        console.log("Segments API Response:", segmentsData)

        // Check different possible segment data formats
        if (segmentsData && Array.isArray(segmentsData.segments)) {
          console.log("Setting segments from segmentsData.segments:", segmentsData.segments)
          setSegments(segmentsData.segments)
        } else if (segmentsData && Array.isArray(segmentsData)) {
          console.log("Setting segments from direct array:", segmentsData)
          setSegments(segmentsData)
        } else if (segmentsData && (segmentsData as any).data && Array.isArray((segmentsData as any).data)) {
          console.log("Setting segments from segmentsData.data:", (segmentsData as any).data)
          setSegments((segmentsData as any).data)
        } else {
          console.error("No valid segments data structure found:", segmentsData)

          // For development - create mock segments if none are available
          const mockSegments = [
            {
              segment_id: "mock1",
              segment_name: "Mock Segment 1",
              description: "This is a mock segment for testing",
              created_by: "Test User",
              status: "active",
              created_at: new Date().toISOString(),
            },
            {
              segment_id: "mock2",
              segment_name: "Mock Segment 2",
              description: "Another mock segment for testing",
              created_by: "Test User",
              status: "active",
              created_at: new Date().toISOString(),
            },
          ]
          console.log("Using mock segments:", mockSegments)
          setSegments(mockSegments)
        }
      } catch (segmentError) {
        console.error("Error loading segments:", segmentError)
        setSegments([])
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Filter tables by search term
  const filteredTables = useMemo(() => {
    return tables.filter((table) =>
      table.tableName.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [tables, searchTerm])

  // Filter segments by search term
  const filteredSegments = useMemo(() => {
    return segments.filter((segment) =>
      segment.segment_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (segment.description && segment.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [segments, searchTerm])

  // Calculate paginated data for tables
  const paginatedTables = useMemo(() => {
    const startIndex = (tablesPagination.currentPage - 1) * tablesPagination.pageSize
    const endIndex = startIndex + tablesPagination.pageSize
    return filteredTables.slice(startIndex, endIndex)
  }, [filteredTables, tablesPagination])

  // Calculate paginated data for segments
  const paginatedSegments = useMemo(() => {
    const startIndex = (segmentsPagination.currentPage - 1) * segmentsPagination.pageSize
    const endIndex = startIndex + segmentsPagination.pageSize
    return filteredSegments.slice(startIndex, endIndex)
  }, [filteredSegments, segmentsPagination])

  // Calculate total pages for tables
  const totalTablesPages = useMemo(() => {
    return Math.ceil(filteredTables.length / tablesPagination.pageSize)
  }, [filteredTables, tablesPagination.pageSize])

  // Calculate total pages for segments
  const totalSegmentsPages = useMemo(() => {
    return Math.ceil(filteredSegments.length / segmentsPagination.pageSize)
  }, [filteredSegments, segmentsPagination.pageSize])

  // Handle page change for tables
  const handleTablesPageChange = (page: number) => {
    setTablesPagination((prev) => ({ ...prev, currentPage: page }))
  }

  // Handle page change for segments
  const handleSegmentsPageChange = (page: number) => {
    setSegmentsPagination((prev) => ({ ...prev, currentPage: page }))
  }

  // Handle page size change for tables
  const handleTablesPageSizeChange = (size: number) => {
    setTablesPagination({ currentPage: 1, pageSize: size })
  }

  // Handle page size change for segments
  const handleSegmentsPageSizeChange = (size: number) => {
    setSegmentsPagination({ currentPage: 1, pageSize: size })
  }

  // Render pagination controls for tables
  const renderTablesPagination = () => {
    const { currentPage, pageSize } = tablesPagination
    const startRecord = ((currentPage - 1) * pageSize) + 1
    const endRecord = Math.min(currentPage * pageSize, filteredTables.length)
    
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pb-2">
        <div className="text-sm text-muted-foreground">
          Showing {startRecord}-{endRecord} of {filteredTables.length} tables
        </div>
        <div className="flex items-center gap-2">
          <Select 
            value={pageSize.toString()} 
            onValueChange={(value) => handleTablesPageSizeChange(parseInt(value))}
          >
            <SelectTrigger className="w-[110px] h-8">
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
                  onClick={() => handleTablesPageChange(currentPage - 1)}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {/* First page */}
              {currentPage > 2 && (
                <PaginationItem>
                  <PaginationLink onClick={() => handleTablesPageChange(1)}>1</PaginationLink>
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
                  <PaginationLink onClick={() => handleTablesPageChange(currentPage - 1)}>
                    {currentPage - 1}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {/* Current page */}
              <PaginationItem>
                <PaginationLink isActive>{currentPage}</PaginationLink>
              </PaginationItem>
              
              {/* Next page */}
              {currentPage < totalTablesPages && (
                <PaginationItem>
                  <PaginationLink onClick={() => handleTablesPageChange(currentPage + 1)}>
                    {currentPage + 1}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {/* Ellipsis */}
              {currentPage < totalTablesPages - 2 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              
              {/* Last page */}
              {currentPage < totalTablesPages - 1 && totalTablesPages > 1 && (
                <PaginationItem>
                  <PaginationLink onClick={() => handleTablesPageChange(totalTablesPages)}>
                    {totalTablesPages}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => handleTablesPageChange(currentPage + 1)}
                  className={currentPage >= totalTablesPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    )
  }

  // Render pagination controls for segments
  const renderSegmentsPagination = () => {
    const { currentPage, pageSize } = segmentsPagination
    const startRecord = ((currentPage - 1) * pageSize) + 1
    const endRecord = Math.min(currentPage * pageSize, filteredSegments.length)
    
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pb-2">
        <div className="text-sm text-muted-foreground">
          Showing {startRecord}-{endRecord} of {filteredSegments.length} segments
        </div>
        <div className="flex items-center gap-2">
          <Select 
            value={pageSize.toString()} 
            onValueChange={(value) => handleSegmentsPageSizeChange(parseInt(value))}
          >
            <SelectTrigger className="w-[110px] h-8">
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
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {/* First page */}
              {currentPage > 2 && (
                <PaginationItem>
                  <PaginationLink onClick={() => handleSegmentsPageChange(1)}>1</PaginationLink>
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
                  <PaginationLink onClick={() => handleSegmentsPageChange(currentPage - 1)}>
                    {currentPage - 1}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {/* Current page */}
              <PaginationItem>
                <PaginationLink isActive>{currentPage}</PaginationLink>
              </PaginationItem>
              
              {/* Next page */}
              {currentPage < totalSegmentsPages && (
                <PaginationItem>
                  <PaginationLink onClick={() => handleSegmentsPageChange(currentPage + 1)}>
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
                  <PaginationLink onClick={() => handleSegmentsPageChange(totalSegmentsPages)}>
                    {totalSegmentsPages}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => handleSegmentsPageChange(currentPage + 1)}
                  className={currentPage >= totalSegmentsPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tables and segments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="segments">Segments</TabsTrigger>
            <TabsTrigger value="tables">Tables</TabsTrigger>
          </TabsList>

          <TabsContent value="segments" className="space-y-4">
            {filteredSegments.length > 0 ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Segments</CardTitle>
                    <CardDescription className="mt-1.5">Manage your data segments and filters</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateDialog(true)} className="flex items-center gap-1">
                    <Plus className="h-4 w-4" />
                    Create Segment
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSegments.map((segment) => (
                        <TableRow key={segment.segment_id || `segment-${Math.random()}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-2">
                              <Filter className="h-4 w-4 text-primary" />
                              <span>{segment.segment_name || "Unnamed Segment"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <span className="text-sm text-muted-foreground">
                              {segment.description || "Custom data segment with filters"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm">
                              <User className="h-4 w-4 mr-1 text-muted-foreground" />
                              {segment.created_by || "Unknown"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={segment.status === "active" ? "default" : "secondary"}>
                              {segment.status || "unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4 mr-1" />
                              {segment.created_at ? new Date(segment.created_at).toLocaleDateString() : "Unknown date"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link href={`/segment/${segment.segment_id}`}>
                              <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                                View
                              </Badge>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {filteredSegments.length > 0 && renderSegmentsPagination()}
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-12">
                <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No segments found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? "Try adjusting your search terms." : "No segments have been created yet."}
                </p>
                <Button onClick={() => setShowCreateDialog(true)} className="flex items-center gap-1">
                  <Plus className="h-4 w-4" />
                  Create Segment
                </Button>
              </div>
            )}

            {/* Create Segment Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Segment</DialogTitle>
                  <DialogDescription>
                    Select a table to create a new segment with filters.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="table-select" className="text-right">
                      Table
                    </Label>
                    <Select
                      value={selectedTable}
                      onValueChange={setSelectedTable}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a table" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto">
                        {tables.map((table) => (
                          <SelectItem key={table.tableName} value={table.tableName}>
                            {table.tableName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSegment}>
                    Continue
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="tables" className="space-y-4">
            {filteredTables.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Tables</CardTitle>
                  <CardDescription>Available database tables</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table Name</TableHead>
                        <TableHead>Database</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTables.map((table, index) => (
                        <TableRow key={`table-${index}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-2">
                              <Database className="h-4 w-4 text-primary" />
                              <span>{table.tableName}</span>
                            </div>
                          </TableCell>
                          <TableCell>{table.database || "Default"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {table.isTemporary ? "Temporary" : "Table"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Link href={`/table/${table.tableName}`}>
                              <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                                View
                              </Badge>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {filteredTables.length > 0 && renderTablesPagination()}
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-12">
                <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No tables found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? "Try adjusting your search terms." : "No tables available in the database."}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
