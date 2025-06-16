"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react"
import { dataService } from "@/services/data-service"

interface Column {
  name: string
  type: string
  nullable: boolean
}

interface DataTableProps {
  data: any[]
  columns: Column[]
}

export function DataTable({ data, columns }: DataTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const itemsPerPage = 10

  // Filter data based on search term
  const filteredData = data.filter((row) =>
    Object.values(row).some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase())),
  )

  // Paginate filtered data
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage)

  const formatCellValue = (value: any, columnType: string) => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">null</span>
    }

    switch (columnType) {
      case "BOOLEAN":
        return (
          <span
            className={`px-2 py-1 rounded text-xs ${value ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {String(value)}
          </span>
        )
      case "TIMESTAMP":
        return new Date(value).toLocaleString()
      case "DECIMAL":
        return typeof value === "number" ? value.toFixed(2) : value
      default:
        return String(value)
    }
  }

  const exportToCSV = () => {
    if (!filteredData.length || !columns.length) {
      return;
    }
    
    // Create a filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').substring(0, 19);
    const filename = `data-export-${timestamp}.csv`;
    
    // Get column names for CSV headers
    const columnNames = columns.map(col => col.name);
    
    // Export data using the data service
    dataService.exportTableDataToCSV(filteredData, columnNames, filename);
  };

  return (
    <div className="space-y-4">
      {/* Search and Export */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search data..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1) // Reset to first page when searching
              }}
              className="pl-10"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredData.length} of {data.length} records
          </div>
        </div>
        
        {/* Export Button */}
        {/* {filteredData.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportToCSV}
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        )} */}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-96">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.name} className="whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium">{column.name}</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        {column.type}
                        {column.nullable && " (nullable)"}
                      </span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No matching records found" : "No data available"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, index) => (
                  <TableRow key={index}>
                    {columns.map((column) => (
                      <TableCell key={column.name} className="whitespace-nowrap">
                        {formatCellValue(row[column.name], column.type)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of{" "}
            {filteredData.length} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                )
              })}
              {totalPages > 5 && (
                <>
                  <span className="text-muted-foreground">...</span>
                  <Button
                    variant={currentPage === totalPages ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    className="w-8 h-8 p-0"
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
