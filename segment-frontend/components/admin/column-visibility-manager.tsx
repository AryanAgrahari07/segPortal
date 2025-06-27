"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Eye, EyeOff, Search, ChevronDown, ChevronUp, RotateCcw, ArrowLeft } from "lucide-react"
import { dataService } from "@/services/data-service"
import { useRouter } from "next/navigation"

interface ColumnVisibilityConfig {
  table_name: string
  column_name: string
  is_visible: boolean
  updated_at: string | null
  updated_by: string | null
  // Track if this column's visibility has been changed from original state
  isDirty?: boolean
  // Store the original value to compare
  original_is_visible?: boolean
}

interface TableInfo {
  database: string
  tableName: string
  isTemporary: boolean
}

interface ColumnVisibilityManagerProps {
  initialTableName?: string
}

export function ColumnVisibilityManager({ initialTableName }: ColumnVisibilityManagerProps) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [selectedTable, setSelectedTable] = useState<string>(initialTableName || "")
  const [columns, setColumns] = useState<ColumnVisibilityConfig[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [tablesLoading, setTablesLoading] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [hasChanges, setHasChanges] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  // Load tables on component mount
  useEffect(() => {
    loadTables()
  }, [])

  // Load columns when table selection changes
  useEffect(() => {
    if (selectedTable) {
      loadColumnVisibility()
    } else {
      setColumns([])
    }
  }, [selectedTable])

  // Load all tables
  const loadTables = async () => {
    setTablesLoading(true)
    try {
      const response = await dataService.getAllTables()
      // console.log("Tables response:", response)
      
      if (response.success && Array.isArray(response.data)) {
        // The API returns tables in the data property
        setTables(response.data)
      } else if (response.success && Array.isArray(response.tables)) {
        // Fallback for old API structure
        setTables(response.tables)
      } else {
        throw new Error("Invalid response format from server")
      }
    } catch (error) {
      console.error("Error loading tables:", error)
      setError("Failed to load tables. Please try again.")
    } finally {
      setTablesLoading(false)
    }
  }

  // Load column visibility configuration for selected table
  const loadColumnVisibility = async () => {
    if (!selectedTable) return

    setLoading(true)
    setError(null)
    try {
      const response = await dataService.getColumnVisibility(selectedTable)
      if (response.success && Array.isArray(response.data)) {
        // Add original_is_visible and isDirty properties to track changes
        const columnsWithTracking = response.data.map(col => ({
          ...col,
          // Store the initial visibility state to compare against for changes
          original_is_visible: col.is_visible,
          isDirty: false
        }))
        setColumns(columnsWithTracking)
        setHasChanges(false)
      } else {
        throw new Error(response.message || "Failed to load column configurations")
      }
    } catch (error: any) {
      console.error("Error loading column visibility:", error)
      setError(error.message || "Failed to load column visibility settings")
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load column visibility settings",
      })
    } finally {
      setLoading(false)
    }
  }

  // Toggle column visibility
  const toggleColumnVisibility = (columnName: string) => {
    setColumns((prev) => {
      const updatedColumns = prev.map((col) => {
        if (col.column_name === columnName) {
          // Check if the new value is different from the original
          const newIsVisible = !col.is_visible
          const isDirty = newIsVisible !== col.original_is_visible
          console.log(`Toggle ${columnName}: ${col.is_visible} -> ${newIsVisible}, isDirty: ${isDirty}`)
          return { 
            ...col, 
            is_visible: newIsVisible,
            isDirty
          }
        }
        return col
      })
      
      // Check if any column is dirty to enable the save button
      const hasAnyChanges = updatedColumns.some(col => col.isDirty)
      console.log(`Has changes after toggle: ${hasAnyChanges}`)
      setHasChanges(hasAnyChanges)
      
      return updatedColumns
    })
  }

  // Save column visibility changes
  const saveChanges = async () => {
    if (!selectedTable) return

    setSaving(true)
    setError(null)
    try {
      // Only include changed columns in the configurations array
      // This includes both newly visible and newly invisible columns
      const changedColumns = columns.filter(col => col.isDirty)
      
      console.log(`Saving ${changedColumns.length} changed columns:`, 
        changedColumns.map(col => `${col.column_name}: ${col.is_visible}`))
      
      if (changedColumns.length === 0) {
        // No changes to save
        console.log('No changes to save')
        setHasChanges(false)
        setSaving(false)
        return
      }
      
      const configurations = changedColumns.map((col) => ({
        column_name: col.column_name,
        is_visible: col.is_visible,
      }))

      const response = await dataService.updateColumnVisibility(
        selectedTable,
        configurations,
        // Get current user from localStorage if available
        localStorage.getItem("userName") || undefined
      )

      if (response.success) {
        // Update original values after successful save
        setColumns(prev => 
          prev.map(col => {
            // Update all columns, marking them as clean
            // and setting their original_is_visible to their current is_visible
            return {
              ...col,
              original_is_visible: col.is_visible,
              isDirty: false
            }
          })
        )
        setHasChanges(false)
        toast({
          title: "Success",
          description: "Column visibility settings saved successfully",
        })
      } else {
        throw new Error(response.message || "Failed to save column configurations")
      }
    } catch (error: any) {
      console.error("Error saving column visibility:", error)
      setError(error.message || "Failed to save column visibility settings")
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save column visibility settings",
      })
    } finally {
      setSaving(false)
    }
  }

  // Reset all columns to visible
  const resetAllColumnsVisible = () => {
    setColumns((prev) => {
      const updatedColumns = prev.map((col) => {
        const newIsVisible = true
        const isDirty = newIsVisible !== col.original_is_visible
        return {
          ...col,
          is_visible: newIsVisible,
          isDirty
        }
      })
      
      // Check if any column has changed to determine if save button should be enabled
      const hasAnyChanges = updatedColumns.some(col => col.isDirty)
      setHasChanges(hasAnyChanges)
      
      return updatedColumns
    })
  }

  // Filter columns by search term
  const filteredColumns = columns.filter((column) =>
    column.column_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Sort columns
  const sortedColumns = [...filteredColumns].sort((a, b) => {
    if (sortOrder === "asc") {
      return a.column_name.localeCompare(b.column_name)
    } else {
      return b.column_name.localeCompare(a.column_name)
    }
  })

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col space-y-2">
        <div className="flex items-start">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1 mb-2 -ml-2 h-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </Button>
        </div>
        <CardTitle>Column Visibility Manager</CardTitle>
        <CardDescription>
          Control which columns will be visible to users in the UI. Hidden columns will not appear in data tables and cannot
          be used in filters.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Table Selection */}
        <div className="space-y-2">
          <Label htmlFor="table-select">Select Table</Label>
          <Select value={selectedTable} onValueChange={setSelectedTable} disabled={tablesLoading}>
            <SelectTrigger id="table-select">
              {tablesLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading tables...</span>
                </div>
              ) : (
                <SelectValue placeholder="Select a table" />
              )}
            </SelectTrigger>
            <SelectContent>
              {tables.length === 0 && !tablesLoading ? (
                <div className="text-center py-2 text-muted-foreground">No tables found</div>
              ) : (
                tables.map((table, index) => (
                  <SelectItem key={`${table.tableName}-${index}`} value={table.tableName}>
                    {table.tableName}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Search & Actions */}
        {selectedTable && (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search columns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSortOrder}
                className="whitespace-nowrap"
              >
                Sort {sortOrder === "asc" ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllColumnsVisible}
                className="whitespace-nowrap"
                title="Reset all columns to visible"
              >
                <RotateCcw className="mr-1 h-4 w-4" /> Reset All
              </Button>
              <Button
                onClick={saveChanges}
                disabled={!hasChanges || saving}
                className="whitespace-nowrap"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Column List */}
        {selectedTable && (
          <>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : columns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No columns found for this table or table does not exist.
              </div>
            ) : (
              <>
                <Separator />
                <ScrollArea className="h-[calc(100vh-400px)] min-h-[300px]">
                  <div className="space-y-2">
                    {sortedColumns.map((column) => (
                      <div
                        key={column.column_name}
                        className={`flex items-center justify-between p-2 hover:bg-muted rounded ${column.isDirty ? 'bg-muted/50' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          {column.is_visible ? (
                            <Eye className="h-4 w-4 text-primary" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span
                            className={`font-mono text-sm ${
                              column.is_visible ? "" : "text-muted-foreground"
                            }`}
                          >
                            {column.column_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-xs text-muted-foreground">
                            {column.updated_at
                              ? `Updated ${new Date(column.updated_at).toLocaleDateString()} by ${
                                  column.updated_by || "system"
                                }`
                              : "Default setting"}
                          </div>
                          <Switch
                            checked={column.is_visible}
                            onCheckedChange={() => toggleColumnVisibility(column.column_name)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
} 