"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Trash2, Calendar, Hash, Type, ToggleLeft } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Column {
  name: string
  type: string
  nullable: boolean
}

interface Filter {
  id: string
  column: string
  operator: string
  value: string
  value2?: string
}

interface FilterBuilderProps {
  filter: Filter
  columns: Column[]
  onUpdate: (updates: Partial<Filter>) => void
  onRemove: () => void
  disabled?: boolean
}

export function FilterBuilder({ filter, columns, onUpdate, onRemove, disabled = false }: FilterBuilderProps) {
  const selectedColumn = columns.find((col) => col.name === filter.column)

  const getOperatorsForType = (type: string) => {
    switch (type) {
      case "STRING":
        return [
          { value: "=", label: "Equals" },
          { value: "!=", label: "Not Equals" },
          { value: "LIKE", label: "Contains" },
          { value: "NOT LIKE", label: "Not Contains" },
          { value: "STARTS_WITH", label: "Starts With" },
          { value: "NOT_STARTS_WITH", label: "Not Starts With" },
          { value: "ENDS_WITH", label: "Ends With" },
          { value: "NOT_ENDS_WITH", label: "Not Ends With" },
          { value: "IN", label: "In List" },
          { value: "NOT_IN", label: "Not In List" },
          { value: "IS NULL", label: "Is Empty" },
          { value: "IS NOT NULL", label: "Is Not Empty" },
        ]
      case "INTEGER":
      case "DECIMAL":
        return [
          { value: "=", label: "Equals" },
          { value: "!=", label: "Not Equals" },
          { value: ">", label: "Greater Than" },
          { value: ">=", label: "Greater or Equal" },
          { value: "<", label: "Less Than" },
          { value: "<=", label: "Less or Equal" },
          { value: "BETWEEN", label: "Between" },
          { value: "NOT_BETWEEN", label: "Not Between" },
          { value: "IN", label: "In List" },
          { value: "NOT_IN", label: "Not In List" },
          { value: "IS NULL", label: "Is Empty" },
          { value: "IS NOT NULL", label: "Is Not Empty" },
        ]
      case "TIMESTAMP":
        return [
          { value: "=", label: "On Date" },
          { value: "!=", label: "Not On Date" },
          { value: ">", label: "After" },
          { value: ">=", label: "On or After" },
          { value: "<", label: "Before" },
          { value: "<=", label: "On or Before" },
          { value: "BETWEEN", label: "Between Dates" },
          { value: "NOT_BETWEEN", label: "Not Between Dates" },
          { value: "IS NULL", label: "Is Empty" },
          { value: "IS NOT NULL", label: "Is Not Empty" },
        ]
      case "BOOLEAN":
        return [
          { value: "=", label: "Equals" },
          { value: "!=", label: "Not Equals" },
          { value: "IS NULL", label: "Is Empty" },
          { value: "IS NOT NULL", label: "Is Not Empty" },
        ]
      default:
        return [
          { value: "=", label: "Equals" },
          { value: "!=", label: "Not Equals" },
          { value: "IS NULL", label: "Is Empty" },
          { value: "IS NOT NULL", label: "Is Not Empty" },
        ]
    }
  }

  const operators = getOperatorsForType(selectedColumn?.type || "STRING")
  const needsSecondValue = filter.operator === "BETWEEN" || filter.operator === "NOT_BETWEEN"
  const needsNoValue = filter.operator === "IS NULL" || filter.operator === "IS NOT NULL"

  const getInputType = (columnType: string) => {
    switch (columnType) {
      case "INTEGER":
        return "number"
      case "DECIMAL":
        return "number"
      case "TIMESTAMP":
        return "datetime-local"
      default:
        return "text"
    }
  }

  const getPlaceholder = (columnType: string, operator: string) => {
    if (operator === "IN" || operator === "NOT_IN") {
      return "value1, value2, value3"
    }
    if (operator === "LIKE") {
      return "search text"
    }
    if (operator === "STARTS_WITH") {
      return "prefix"
    }
    if (operator === "ENDS_WITH") {
      return "suffix"
    }
    switch (columnType) {
      case "INTEGER":
        return "123"
      case "DECIMAL":
        return "123.45"
      case "BOOLEAN":
        return "true/false"
      default:
        return "Enter value"
    }
  }

  const getColumnIcon = (type: string) => {
    switch (type) {
      case "STRING":
        return <Type className="h-3 w-3" />
      case "INTEGER":
      case "DECIMAL":
        return <Hash className="h-3 w-3" />
      case "TIMESTAMP":
        return <Calendar className="h-3 w-3" />
      case "BOOLEAN":
        return <ToggleLeft className="h-3 w-3" />
      default:
        return <Type className="h-3 w-3" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "STRING":
        return "text-green-600 dark:text-green-400"
      case "INTEGER":
      case "DECIMAL":
        return "text-blue-600 dark:text-blue-400"
      case "TIMESTAMP":
        return "text-purple-600 dark:text-purple-400"
      case "BOOLEAN":
        return "text-orange-600 dark:text-orange-400"
      default:
        return "text-gray-600 dark:text-gray-400"
    }
  }

  return (
    <TooltipProvider>
      <div
        className={`flex flex-col gap-3 p-4 border rounded-lg transition-all w-full max-w-[800px] ${
          disabled ? "bg-muted/50 border-muted opacity-60" : "bg-card border-border hover:border-primary/50"
        }`}
      >
        {/* First Line: Column and Operator Selection */}
        <div className="flex items-center gap-3">
          {/* Column Selection */}
          <div className="w-[60%] min-w-[100px]">
            <Select value={filter.column} onValueChange={(value) => onUpdate({ column: value })} disabled={disabled}>
              <SelectTrigger className="h-9 text-sm truncate">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {columns.map((column) => (
                  <SelectItem key={column.name} value={column.name}>
                    <div className="flex items-center space-x-2 pr-2">
                      <span className={getTypeColor(column.type)}>{getColumnIcon(column.type)}</span>
                      <span className="font-medium truncate">{column.name}</span>
                      <Badge variant="outline" className="text-xs whitespace-nowrap flex-shrink-0">
                        {column.type}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Operator Selection */}
          <div className="w-[40%] min-w-[100px]">
            <Select value={filter.operator} onValueChange={(value) => onUpdate({ operator: value })} disabled={disabled}>
              <SelectTrigger className="h-9 text-sm truncate">
                <SelectValue placeholder="Select operator" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {operators.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    <span className="truncate">{op.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Second Line: Value Input and Delete Button */}
        <div className="flex items-center gap-3">
          {/* Value Input(s) */}
          <div className="flex-1 min-w-0">
            {needsNoValue ? (
              <div className="h-9 flex items-center text-sm text-muted-foreground px-3 bg-muted rounded-md">
                No value needed
              </div>
            ) : needsSecondValue ? (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type={getInputType(selectedColumn?.type || "STRING")}
                  value={filter.value}
                  onChange={(e) => onUpdate({ value: e.target.value })}
                  placeholder="From"
                  className="h-9 text-sm"
                  disabled={disabled}
                />
                <Input
                  type={getInputType(selectedColumn?.type || "STRING")}
                  value={filter.value2 || ""}
                  onChange={(e) => onUpdate({ value2: e.target.value })}
                  placeholder="To"
                  className="h-9 text-sm"
                  disabled={disabled}
                />
              </div>
            ) : selectedColumn?.type === "BOOLEAN" ? (
              <Select value={filter.value} onValueChange={(value) => onUpdate({ value })} disabled={disabled}>
                <SelectTrigger className="h-9 text-sm truncate">
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={getInputType(selectedColumn?.type || "STRING")}
                value={filter.value}
                onChange={(e) => onUpdate({ value: e.target.value })}
                placeholder={getPlaceholder(selectedColumn?.type || "STRING", filter.operator)}
                className="h-9 text-sm"
                disabled={disabled}
              />
            )}
          </div>

          {/* Remove Button */}
          <div className="flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  disabled={disabled}
                  className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove filter</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
