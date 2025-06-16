"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Database, Filter, Search, Calendar, User, Play } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { dataService } from "@/services/data-service"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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

export default function DashboardPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const defaultTab = searchParams?.get("tab") || "tables"

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

  // const filteredTables = tables.filter(
  //   (table) =>
  //     // table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     table.description.toLowerCase().includes(searchTerm.toLowerCase()) ,
  // )

  // const filteredSegments = segments.filter(
  //   (segment) =>
  //     segment.segment_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     (segment.description && segment.description.toLowerCase().includes(searchTerm.toLowerCase())),
  // )

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
        {/* <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Data Platform</h1>
            <p className="text-muted-foreground">Welcome back, {user?.first_name}! Manage your tables and segments.</p>
          </div>
        </div> */}

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
            <TabsTrigger value="tables">Tables</TabsTrigger>
            <TabsTrigger value="segments">Segments</TabsTrigger>
          </TabsList>

          <TabsContent value="tables" className="space-y-4">
            {Array.isArray(tables) && tables.length > 0 ? (
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
                      {tables.map((table, index) => (
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

          <TabsContent value="segments" className="space-y-4">
            {Array.isArray(segments) && segments.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Segments</CardTitle>
                  <CardDescription>Manage your data segments and filters</CardDescription>
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
                        {/* <TableHead>Last Executed</TableHead> */}
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {segments.map((segment) => (
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
                          {/* <TableCell>
                            {segment.last_executed ? (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Play className="h-4 w-4 mr-1" />
                                {new Date(segment.last_executed).toLocaleDateString()}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Never</span>
                            )}
                          </TableCell> */}
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
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-12">
                <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No segments found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? "Try adjusting your search terms." : "No segments have been created yet."}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
