"use client"

import React from "react"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatValueForDisplay } from "@/lib/data-formatter"
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
  // If there's no data, show a message
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  // Get column names from the data if no columns were provided
  const tableColumns = columns && columns.length > 0 
    ? columns 
    : Object.keys(data[0]).map(key => ({ name: key, type: typeof data[0][key], nullable: true }));

  // Render cell with appropriate styling based on data type and value
  const renderCell = (value: any, columnType: string) => {
    const formattedValue = formatValueForDisplay(value, columnType);
    
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">{formattedValue}</span>;
    }

    const normalizedType = columnType.toUpperCase();
    
    // Apply styling based on data type
    switch (normalizedType) {
      case "BOOLEAN":
        return (
          <span
            className={`px-2 py-1 rounded text-xs ${
              value ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {formattedValue}
          </span>
        );
      case "TIMESTAMP":
      case "DATE":
      case "DATETIME":
        return <span className="whitespace-nowrap">{formattedValue}</span>;
      default:
        return formattedValue;
    }
  };

  return (
    <div className="overflow-auto max-h-[calc(100vh-25rem)] custom-scrollbar table-scrollbar relative">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow className="border-b border-border/50">
            {tableColumns.map((column) => (
              <TableHead key={column.name} className="whitespace-nowrap bg-background py-3">
                <div className="flex items-center gap-1">
                  <span className="font-medium">{column.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({column.type.toLowerCase()})
                  </span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={`row-${index}`} className="hover:bg-muted/30 transition-colors">
              {tableColumns.map((column) => (
                <TableCell key={`${index}-${column.name}`} className="truncate max-w-xs py-2.5">
                  {renderCell(row[column.name], column.type)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
