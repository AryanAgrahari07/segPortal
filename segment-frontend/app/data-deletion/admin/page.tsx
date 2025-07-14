"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { AlertCircle, CheckCircle, Clock, XCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { dataDeletionService, type DeletionRequest, type PaginationMeta, type StatusFilter } from "@/services/data-deletion-service"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function DataDeletionAdminPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [pageInput, setPageInput] = useState("")

  // Get parameters from URL
  const currentPage = parseInt(searchParams.get("page") || "1")
  const pageSize = parseInt(searchParams.get("limit") || "10")
  const currentStatus = (searchParams.get("status") || "pending") as StatusFilter
  
  useEffect(() => {
    // Redirect non-admin users
    if (user && user.role !== "admin") {
      router.push("/data-deletion")
      return
    }

    // Only fetch data if user is admin
    if (user?.role === "admin") {
      fetchDeletionRequests(currentPage, pageSize, currentStatus)
      setPageInput(currentPage.toString())
    }
  }, [user, router, currentPage, pageSize, currentStatus])

  // If user is not admin, don't render anything (useEffect will handle redirection)
  if (!user || user.role !== "admin") {
    return null
  }

  const fetchDeletionRequests = async (page: number, limit: number, status: StatusFilter) => {
    try {
      setIsLoading(true)
      const response = await dataDeletionService.getAllDeletionRequests(page, limit, status)
      setDeletionRequests(response.data)
      setPagination(response.pagination)
    } catch (error) {
      console.error("Error fetching deletion requests:", error)
      toast({
        title: "Error",
        description: "Failed to load deletion requests. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (pagination && newPage > pagination.totalPages)) return
    router.push(`/data-deletion/admin?page=${newPage}&limit=${pageSize}&status=${currentStatus}`)
  }

  const handlePageSizeChange = (newSize: string) => {
    router.push(`/data-deletion/admin?page=1&limit=${newSize}&status=${currentStatus}`)
  }

  const handleStatusChange = (newStatus: string) => {
    router.push(`/data-deletion/admin?page=1&limit=${pageSize}&status=${newStatus}`)
  }

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value.replace(/[^0-9]/g, ''))
  }

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const page = parseInt(pageInput)
    if (page && page > 0 && (!pagination || page <= pagination.totalPages)) {
      handlePageChange(page)
    } else if (pagination) {
      setPageInput(currentPage.toString())
      toast({
        title: "Invalid page",
        description: `Please enter a page number between 1 and ${pagination.totalPages}`,
        variant: "destructive",
      })
    }
  }

  const handleProcessRequest = async (requestId: string) => {
    try {
      setProcessingId(requestId)
      
      await dataDeletionService.processDeletionRequest(requestId)
      
      toast({
        title: "Success",
        description: "Data deletion request has been processed successfully.",
      })
      
      // Refresh the current page
      fetchDeletionRequests(currentPage, pageSize, currentStatus)
    } catch (error) {
      console.error("Error processing deletion request:", error)
      toast({
        title: "Error",
        description: "Failed to process deletion request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "PPP p")
    } catch (error) {
      return "Invalid date"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800">
          <Clock className="h-3 w-3 mr-1" /> Pending
        </Badge>
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
          <CheckCircle className="h-3 w-3 mr-1" /> Completed
        </Badge>
      case "failed":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
          <XCircle className="h-3 w-3 mr-1" /> Failed
        </Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-violet-200 dark:border-violet-800 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border-b border-violet-200 dark:border-violet-800">
          <CardTitle className="text-violet-900 dark:text-violet-100">Data Deletion Requests</CardTitle>
          <CardDescription>
            Review and process customer data deletion requests.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="relative">
                <div className="w-12 h-12 mx-auto relative">
                  {/* Outer ring animation */}
                  <div className="absolute inset-0 rounded-full border-4 border-violet-200 dark:border-violet-800/40"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-600 dark:border-t-violet-400 animate-spin"></div>
                </div>
              </div>
            </div>
          ) : (
            <Tabs defaultValue={currentStatus} onValueChange={handleStatusChange} className="w-full">
              <TabsList className="mb-4 bg-violet-100/50 dark:bg-violet-900/20">
                <TabsTrigger 
                  value="pending"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
                >
                  Pending
                </TabsTrigger>
                <TabsTrigger 
                  value="completed"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
                >
                  Completed
                </TabsTrigger>
                <TabsTrigger 
                  value="failed"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
                >
                  Failed
                </TabsTrigger>
                <TabsTrigger 
                  value="all"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
                >
                  All
                </TabsTrigger>
              </TabsList>
              
              <div>
                {renderRequestsTable(deletionRequests)}
                
                {/* Enhanced Pagination UI */}
                {pagination && pagination.totalPages > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
                    <div className="text-sm text-violet-600 dark:text-violet-400">
                      Showing {deletionRequests.length} of {pagination.total} results
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Page size selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-violet-600 dark:text-violet-400">Rows per page:</span>
                        <Select 
                          value={pageSize.toString()}
                          onValueChange={handlePageSizeChange}
                        >
                          <SelectTrigger className="w-16 border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30">
                            <SelectValue placeholder={pageSize.toString()} />
                          </SelectTrigger>
                          <SelectContent className="border-violet-200 dark:border-violet-800">
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Page navigation */}
                      <div className="flex items-center">
                        {/* First page */}
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30"
                          onClick={() => handlePageChange(1)}
                          disabled={pagination.page === 1}
                        >
                          <ChevronsLeft className="h-4 w-4" />
                          <span className="sr-only">First Page</span>
                        </Button>
                        
                        {/* Previous page */}
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8 ml-2 border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30"
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={!pagination.hasPrevPage}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="sr-only">Previous Page</span>
                        </Button>
                        
                        {/* Page input */}
                        <form 
                          onSubmit={handlePageInputSubmit} 
                          className="flex items-center mx-2"
                        >
                          <Input 
                            type="text"
                            className="h-8 w-12 px-2 text-center border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30"
                            value={pageInput}
                            onChange={handlePageInputChange}
                            aria-label="Current page"
                          />
                          <span className="mx-2 text-sm text-violet-600 dark:text-violet-400">of {pagination.totalPages}</span>
                        </form>
                        
                        {/* Next page */}
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8 mr-2 border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30"
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={!pagination.hasNextPage}
                        >
                          <ChevronRight className="h-4 w-4" />
                          <span className="sr-only">Next Page</span>
                        </Button>
                        
                        {/* Last page */}
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8 border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30"
                          onClick={() => handlePageChange(pagination.totalPages)}
                          disabled={pagination.page === pagination.totalPages}
                        >
                          <ChevronsRight className="h-4 w-4" />
                          <span className="sr-only">Last Page</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )

  function renderRequestsTable(requests: DeletionRequest[]) {
    if (requests.length === 0) {
      return (
        <Alert className="border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20">
          <AlertCircle className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <AlertTitle className="text-violet-700 dark:text-violet-300">No requests found</AlertTitle>
          <AlertDescription className="text-violet-600 dark:text-violet-400">
            There are no data deletion requests in this category.
          </AlertDescription>
        </Alert>
      )
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-violet-50/50 dark:bg-violet-900/10">
            <TableRow className="border-violet-200 dark:border-violet-800 hover:bg-violet-100/50 dark:hover:bg-violet-900/20">
              <TableHead className="text-violet-700 dark:text-violet-300">Customer Email</TableHead>
              <TableHead className="text-violet-700 dark:text-violet-300">Status</TableHead>
              <TableHead className="text-violet-700 dark:text-violet-300">Request Time</TableHead>
              <TableHead className="text-violet-700 dark:text-violet-300">Created Time</TableHead>
              <TableHead className="text-violet-700 dark:text-violet-300">Notes</TableHead>
              <TableHead className="text-violet-700 dark:text-violet-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.request_id} className="border-violet-200 dark:border-violet-800 hover:bg-violet-50/50 dark:hover:bg-violet-900/10">
                <TableCell className="font-medium">{request.customer_email}</TableCell>
                <TableCell>{getStatusBadge(request.status)}</TableCell>
                <TableCell>{formatDateTime(request.customer_request_timestamp)}</TableCell>
                <TableCell>{formatDateTime(request.entry_created_timestamp)}</TableCell>
                <TableCell className="max-w-xs truncate">{request.notes || "-"}</TableCell>
                <TableCell>
                  {request.status.toLowerCase() === "pending" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          size="sm" 
                          disabled={processingId === request.request_id}
                          className="bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white"
                        >
                          {processingId === request.request_id ? "Processing..." : "Approve Deletion"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-white to-violet-50 dark:from-gray-950 dark:to-violet-950/30">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-violet-900 dark:text-violet-100">Confirm Data Deletion</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to approve this data deletion request? 
                            This action will permanently delete all data associated with 
                            <span className="font-semibold"> {request.customer_email}</span> from:
                            <ul className="list-disc list-inside mt-2">
                              <li>Databricks</li>
                              <li>Shopify</li>
                              <li>Braze</li>
                            </ul>
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleProcessRequest(request.request_id)}
                            className="bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white"
                          >
                            Confirm Deletion
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  
                  {request.status.toLowerCase() === "completed" && (
                    <div className="text-sm text-muted-foreground">
                      Processed by: {request.processed_by_admin_email}<br />
                      {request.processed_at_timestamp && (
                        <>at {formatDateTime(request.processed_at_timestamp)}</>
                      )}
                    </div>
                  )}
                  
                  {request.status.toLowerCase() === "failed" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      disabled={processingId === request.request_id}
                      onClick={() => handleProcessRequest(request.request_id)}
                      className="border-violet-300 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                    >
                      {processingId === request.request_id ? "Processing..." : "Retry"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }
}