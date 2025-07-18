"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { AlertCircle, CheckCircle, Clock, XCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ListFilter, FormInput, Eye, Check, X } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import DataDeletionForm from "../components/data-deletion-form"

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
  const [mainView, setMainView] = useState<"requests" | "form">("requests")
  const [selectedRequests, setSelectedRequests] = useState<string[]>([])
  const [isProcessingBulk, setIsProcessingBulk] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [isRejectionDialogOpen, setIsRejectionDialogOpen] = useState(false)
  const [detailViewRequest, setDetailViewRequest] = useState<DeletionRequest | null>(null)

  // Get parameters from URL
  const currentPage = parseInt(searchParams.get("page") || "1")
  const pageSize = parseInt(searchParams.get("limit") || "10")
  const currentStatus = (searchParams.get("status") || "pending") as StatusFilter
  
  // Calculate if there are pending requests for bulk actions
  const pendingRequests = deletionRequests.filter(req => req.status.toLowerCase() === 'pending')
  const hasPendingRequests = pendingRequests.length > 0
  const allPendingSelected = hasPendingRequests && pendingRequests.every(req => 
    selectedRequests.includes(req.request_id)
  )

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

  const handleSelectRequest = (requestId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedRequests(prev => [...prev, requestId])
    } else {
      setSelectedRequests(prev => prev.filter(id => id !== requestId))
    }
  }

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      const pendingRequestIds = deletionRequests
        .filter(req => req.status.toLowerCase() === 'pending')
        .map(req => req.request_id)
      setSelectedRequests(pendingRequestIds)
    } else {
      setSelectedRequests([])
    }
  }

  const handleProcessBulkRequests = async () => {
    if (selectedRequests.length === 0) return

    try {
      setIsProcessingBulk(true)
      
      const response = await dataDeletionService.processBulkDeletionRequests(selectedRequests)
      
      toast({
        title: "Success",
        description: `Processed ${response.data.successful.length} requests successfully${
          response.data.failed.length > 0 ? ` with ${response.data.failed.length} failures` : ''
        }`,
      })
      
      // Clear selections and refresh the current page
      setSelectedRequests([])
      fetchDeletionRequests(currentPage, pageSize, currentStatus)
    } catch (error) {
      console.error("Error processing bulk deletion requests:", error)
      toast({
        title: "Error",
        description: "Failed to process deletion requests. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessingBulk(false)
    }
  }

  const handleRejectBulkRequests = async () => {
    if (selectedRequests.length === 0 || !rejectionReason) return

    try {
      setIsProcessingBulk(true)
      
      const response = await dataDeletionService.rejectBulkDeletionRequests(selectedRequests, rejectionReason)
      
      toast({
        title: "Success",
        description: `Rejected ${response.data.successful.length} requests successfully${
          response.data.failed.length > 0 ? ` with ${response.data.failed.length} failures` : ''
        }`,
      })
      
      // Clear selections and refresh the current page
      setSelectedRequests([])
      setRejectionReason("")
      setIsRejectionDialogOpen(false)
      fetchDeletionRequests(currentPage, pageSize, currentStatus)
    } catch (error) {
      console.error("Error rejecting deletion requests:", error)
      toast({
        title: "Error",
        description: "Failed to reject deletion requests. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessingBulk(false)
    }
  }

  const handleRejectRequest = async (requestId: string, reason: string) => {
    try {
      setProcessingId(requestId)
      
      await dataDeletionService.rejectDeletionRequest(requestId, reason)
      
      toast({
        title: "Success",
        description: "Data deletion request has been rejected successfully.",
      })
      
      // Refresh the current page
      fetchDeletionRequests(currentPage, pageSize, currentStatus)
    } catch (error) {
      console.error("Error rejecting deletion request:", error)
      toast({
        title: "Error",
        description: "Failed to reject deletion request. Please try again.",
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
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
          <XCircle className="h-3 w-3 mr-1" /> Rejected
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
      {/* Main View Tabs - Switch between Requests and Form */}
      <Tabs defaultValue="requests" onValueChange={(value) => setMainView(value as "requests" | "form")} className="w-full">
        <TabsList className="mb-4 bg-violet-100/50 dark:bg-violet-900/20">
          <TabsTrigger 
            value="requests"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
          >
            <ListFilter className="h-4 w-4 mr-2" />
            Manage Requests
          </TabsTrigger>
          <TabsTrigger 
            value="form"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
          >
            <FormInput className="h-4 w-4 mr-2" />
            Create New DSR Request
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card className="border-violet-200 dark:border-violet-800 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border-b border-violet-200 dark:border-violet-800">
              <CardTitle className="text-violet-900 dark:text-violet-100">DSR Requests</CardTitle>
              <CardDescription>
                Review and process customer DSR requests.
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                    <TabsList className="bg-violet-100/50 dark:bg-violet-900/20">
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
                        value="rejected"
                        className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
                      >
                        Rejected
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
                    
                    {/* Bulk actions - moved to be in the same line as tabs */}
                    {hasPendingRequests && (
                      <div className="flex flex-wrap gap-2">
                        <AlertDialog open={isRejectionDialogOpen} onOpenChange={setIsRejectionDialogOpen}>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={selectedRequests.length === 0 || isProcessingBulk}
                              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject Selected
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-white to-violet-50 dark:from-gray-950 dark:to-violet-950/30">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-violet-900 dark:text-violet-100">Reject DSR Requests</AlertDialogTitle>
                              <AlertDialogDescription>
                                You are about to reject {selectedRequests.length} data deletion request(s).
                                Please provide a reason for rejection:
                                
                                <div className="mt-4">
                                  <Input 
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Reason for rejection"
                                    className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30"
                                  />
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30">Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={handleRejectBulkRequests}
                                disabled={!rejectionReason || isProcessingBulk}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                {isProcessingBulk ? "Processing..." : "Reject Requests"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <Button 
                          size="sm"
                          disabled={selectedRequests.length === 0 || isProcessingBulk}
                          onClick={handleProcessBulkRequests}
                          className="bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {isProcessingBulk ? "Processing..." : `Approve Selected (${selectedRequests.length})`}
                        </Button>
                      </div>
                    )}
                  </div>
                  
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
        </TabsContent>

        <TabsContent value="form">
          <Card className="border-violet-200 dark:border-violet-800 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border-b border-violet-200 dark:border-violet-800">
              <CardTitle className="text-violet-900 dark:text-violet-100">Create DSR Request</CardTitle>
              <CardDescription>
                Create a new data deletion request on behalf of a customer.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <DataDeletionForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
      <div>
        {/* Bulk actions - removed from here and moved to be in the same line as tabs */}

        {/* Detail View Dialog */}
        <Dialog open={!!detailViewRequest} onOpenChange={(open) => !open && setDetailViewRequest(null)}>
          {detailViewRequest && (
            <DialogContent className="max-w-3xl border-violet-200 dark:border-violet-800 bg-gradient-to-br from-white to-violet-50 dark:from-gray-950 dark:to-violet-950/30">
              <DialogHeader>
                <DialogTitle className="text-violet-900 dark:text-violet-100 flex items-center gap-2">
                  <span>DSR Request Details</span>
                  <Badge variant="outline" className="ml-2">
                    {getStatusBadge(detailViewRequest.status)}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Detailed information about this data subject request
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-violet-700 dark:text-violet-300">Customer Email</div>
                  <div className="text-sm">{detailViewRequest.customer_email}</div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium text-violet-700 dark:text-violet-300">Status</div>
                  <div>{getStatusBadge(detailViewRequest.status)}</div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium text-violet-700 dark:text-violet-300">Request Time</div>
                  <div className="text-sm">{formatDateTime(detailViewRequest.customer_request_timestamp)}</div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium text-violet-700 dark:text-violet-300">Created Time</div>
                  <div className="text-sm">{formatDateTime(detailViewRequest.entry_created_timestamp)}</div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium text-violet-700 dark:text-violet-300">Request ID</div>
                  <div className="text-sm font-mono text-xs bg-violet-50 dark:bg-violet-900/20 p-1 rounded">{detailViewRequest.request_id}</div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium text-violet-700 dark:text-violet-300">Deletion Sources</div>
                  <div>
                    {detailViewRequest.deletion_sources ? detailViewRequest.deletion_sources.split(',').map((source, i) => (
                      <Badge key={i} variant="outline" className="mr-1 mb-1 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800">
                        {source}
                      </Badge>
                    )) : "No Sources"}
                  </div>
                </div>
                
                <div className="space-y-2 col-span-2">
                  <div className="text-sm font-medium text-violet-700 dark:text-violet-300">Notes</div>
                  <div className="text-sm p-2 bg-violet-50 dark:bg-violet-900/20 rounded min-h-[60px]">
                    {detailViewRequest.notes || "No notes provided"}
                  </div>
                </div>
                
                {detailViewRequest.processed_by_admin_email && (
                  <>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-violet-700 dark:text-violet-300">Processed By</div>
                      <div className="text-sm">{detailViewRequest.processed_by_admin_email}</div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-violet-700 dark:text-violet-300">Processed At</div>
                      <div className="text-sm">{detailViewRequest.processed_at_timestamp ? formatDateTime(detailViewRequest.processed_at_timestamp) : "N/A"}</div>
                    </div>
                  </>
                )}
              </div>
              
              <DialogFooter className="gap-2 flex-wrap">
                {detailViewRequest.status.toLowerCase() === "pending" && (
                  <>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline"
                          size="sm"
                          className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject Request
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-white to-violet-50 dark:from-gray-950 dark:to-violet-950/30">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-violet-900 dark:text-violet-100">Reject DSR Request</AlertDialogTitle>
                          <AlertDialogDescription>
                            You are about to reject the DSR request from <span className="font-semibold">{detailViewRequest.customer_email}</span>.
                            Please provide a reason for rejection:
                            
                            <div className="mt-4">
                              <Input 
                                id={`detail-reject-reason-${detailViewRequest.request_id}`}
                                placeholder="Reason for rejection"
                                className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30"
                              />
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => {
                              const reasonInput = document.getElementById(`detail-reject-reason-${detailViewRequest.request_id}`) as HTMLInputElement
                              if (reasonInput && reasonInput.value) {
                                handleRejectRequest(detailViewRequest.request_id, reasonInput.value)
                                setDetailViewRequest(null)
                              } else {
                                toast({
                                  title: "Error",
                                  description: "Please provide a reason for rejection",
                                  variant: "destructive",
                                })
                              }
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Reject Request
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          size="sm"
                          className="bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Approve Request
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-white to-violet-50 dark:from-gray-950 dark:to-violet-950/30">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-violet-900 dark:text-violet-100">Confirm DSR Request</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to approve this DSR request? 
                            This action will permanently delete all data associated with 
                            <span className="font-semibold"> {detailViewRequest.customer_email}</span> from the following sources:
                            <ul className="list-disc list-inside mt-2">
                              {detailViewRequest.deletion_sources ? 
                                detailViewRequest.deletion_sources.split(',').map((source, i) => (
                                  <li key={i}>{source}</li>
                                ))
                                : 
                                <>
                                  <li>Shopify</li>
                                  <li>Braze</li>
                                  <li>CDR</li>
                                </>
                              }
                            </ul>
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => {
                              handleProcessRequest(detailViewRequest.request_id)
                              setDetailViewRequest(null)
                            }}
                            className="bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white"
                          >
                            Confirm DSR
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
                
                {detailViewRequest.status.toLowerCase() === "failed" && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      handleProcessRequest(detailViewRequest.request_id)
                      setDetailViewRequest(null)
                    }}
                    className="border-violet-300 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                  >
                    Retry
                  </Button>
                )}
                
                <Button 
                  variant="outline"
                  onClick={() => setDetailViewRequest(null)}
                  className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30"
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-violet-50/50 dark:bg-violet-900/10">
              <TableRow className="border-violet-200 dark:border-violet-800 hover:bg-violet-100/50 dark:hover:bg-violet-900/20">
                {hasPendingRequests && (
                  <TableHead className="w-[50px]">
                    <input 
                      type="checkbox" 
                      checked={allPendingSelected && pendingRequests.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-violet-300 text-violet-600 focus:ring-violet-500/30 dark:border-violet-700 dark:bg-violet-900/20"
                    />
                  </TableHead>
                )}
                <TableHead className="text-violet-700 dark:text-violet-300">Customer Email</TableHead>
                <TableHead className="text-violet-700 dark:text-violet-300">Status</TableHead>
                <TableHead className="text-violet-700 dark:text-violet-300">Request Time</TableHead>
                <TableHead className="text-violet-700 dark:text-violet-300">Created Time</TableHead>
                <TableHead className="text-violet-700 dark:text-violet-300">Deletion Sources</TableHead>
                <TableHead className="text-violet-700 dark:text-violet-300">Notes</TableHead>
                <TableHead className="text-violet-700 dark:text-violet-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.request_id} className="border-violet-200 dark:border-violet-800 hover:bg-violet-50/50 dark:hover:bg-violet-900/10">
                  {hasPendingRequests && (
                    <TableCell>
                      {request.status.toLowerCase() === 'pending' && (
                        <input 
                          type="checkbox" 
                          checked={selectedRequests.includes(request.request_id)}
                          onChange={(e) => handleSelectRequest(request.request_id, e.target.checked)}
                          className="rounded border-violet-300 text-violet-600 focus:ring-violet-500/30 dark:border-violet-700 dark:bg-violet-900/20"
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{request.customer_email}</TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>{formatDateTime(request.customer_request_timestamp)}</TableCell>
                  <TableCell>{formatDateTime(request.entry_created_timestamp)}</TableCell>
                  <TableCell>
                    {request.deletion_sources ? request.deletion_sources.split(',').map((source, i) => (
                      <Badge key={i} variant="outline" className="mr-1 mb-1 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800">
                        {source}
                      </Badge>
                    )) : "No Sources"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{request.notes || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDetailViewRequest(request)}
                        className="h-8 w-8 text-violet-600 hover:text-violet-700 hover:bg-violet-100/50 dark:text-violet-400 dark:hover:bg-violet-900/30"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View Details</span>
                      </Button>
                      
                      {request.status.toLowerCase() === "pending" && (
                        <>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100/50 dark:text-green-400 dark:hover:bg-green-900/30"
                              >
                                <Check className="h-4 w-4" />
                                <span className="sr-only">Approve</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-white to-violet-50 dark:from-gray-950 dark:to-violet-950/30">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-violet-900 dark:text-violet-100">Confirm DSR Request</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to approve this DSR request? 
                                  This action will permanently delete all data associated with 
                                  <span className="font-semibold"> {request.customer_email}</span> from the following sources:
                                  <ul className="list-disc list-inside mt-2">
                                    {request.deletion_sources ? 
                                      request.deletion_sources.split(',').map((source, i) => (
                                        <li key={i}>{source}</li>
                                      ))
                                      : 
                                      <>
                                        <li>Shopify</li>
                                        <li>Braze</li>
                                        <li>CDR</li>
                                      </>
                                    }
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
                                  Confirm DSR
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100/50 dark:text-red-400 dark:hover:bg-red-900/30"
                              >
                                <X className="h-4 w-4" />
                                <span className="sr-only">Reject</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-white to-violet-50 dark:from-gray-950 dark:to-violet-950/30">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-violet-900 dark:text-violet-100">Reject DSR Request</AlertDialogTitle>
                                <AlertDialogDescription>
                                  You are about to reject the DSR request from <span className="font-semibold">{request.customer_email}</span>.
                                  Please provide a reason for rejection:
                                  
                                  <div className="mt-4">
                                    <Input 
                                      id={`reject-reason-${request.request_id}`}
                                      placeholder="Reason for rejection"
                                      className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30"
                                    />
                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30">Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => {
                                    const reasonInput = document.getElementById(`reject-reason-${request.request_id}`) as HTMLInputElement
                                    if (reasonInput && reasonInput.value) {
                                      handleRejectRequest(request.request_id, reasonInput.value)
                                    } else {
                                      toast({
                                        title: "Error",
                                        description: "Please provide a reason for rejection",
                                        variant: "destructive",
                                      })
                                    }
                                  }}
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                  Reject Request
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                      
                      {request.status.toLowerCase() === "failed" && (
                        <Button 
                          variant="ghost"
                          size="icon"
                          disabled={processingId === request.request_id}
                          onClick={() => handleProcessRequest(request.request_id)}
                          className="h-8 w-8 text-violet-600 hover:text-violet-700 hover:bg-violet-100/50 dark:text-violet-400 dark:hover:bg-violet-900/30"
                        >
                          {processingId === request.request_id ? (
                            <span className="h-4 w-4 border-2 border-t-transparent border-violet-600 dark:border-violet-400 rounded-full animate-spin" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                              <path d="M3 3v5h5" />
                              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                              <path d="M16 16h5v5" />
                            </svg>
                          )}
                          <span className="sr-only">Retry</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }
}