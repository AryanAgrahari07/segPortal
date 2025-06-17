"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Trash2, Plus, Settings, ChevronDown, ChevronRight, GripVertical, Copy, Eye, EyeOff, ListFilter } from "lucide-react"
import { FilterBuilder } from "./filter-builder"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Column {
  name: string
  type: string
  nullable: boolean
}

interface FilterItem {
  id: string
  column: string
  operator: string
  value: string
  value2?: string
}

interface FilterGroup {
  id: string
  name: string
  condition: "AND" | "OR" | "NOT"
  filters: FilterItem[]
  isCollapsed?: boolean
  isEnabled?: boolean
}

interface FilterGroupBuilderProps {
  group: FilterGroup
  columns: Column[]
  onUpdate: (updates: Partial<FilterGroup>) => void
  onRemove: () => void
  onDuplicate?: () => void
  rowCount?: number
}

export function FilterGroupBuilder({ group, columns, onUpdate, onRemove, onDuplicate, rowCount }: FilterGroupBuilderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(group.name)
  const [isCollapsed, setIsCollapsed] = useState(group.isCollapsed || false)
  const [isEnabled, setIsEnabled] = useState(group.isEnabled !== false)

  const addFilter = () => {
    const newFilter: FilterItem = {
      id: `filter_${Date.now()}`,
      column: columns[0]?.name || "",
      operator: "=",
      value: "",
    }
    onUpdate({ filters: [...group.filters, newFilter] })
  }

  const updateFilter = (filterId: string, updates: Partial<FilterItem>) => {
    const updatedFilters = group.filters.map((filter) => (filter.id === filterId ? { ...filter, ...updates } : filter))
    onUpdate({ filters: updatedFilters })
  }

  const removeFilter = (filterId: string) => {
    const updatedFilters = group.filters.filter((filter) => filter.id !== filterId)
    onUpdate({ filters: updatedFilters })
  }

  const handleNameSave = () => {
    onUpdate({ name: editName })
    setIsEditing(false)
  }

  const toggleCollapsed = () => {
    const newCollapsed = !isCollapsed
    setIsCollapsed(newCollapsed)
    onUpdate({ isCollapsed: newCollapsed })
  }

  const toggleEnabled = () => {
    const newEnabled = !isEnabled
    setIsEnabled(newEnabled)
    onUpdate({ isEnabled: newEnabled })
  }

  const getGroupColor = () => {
    if (!isEnabled) return "border-muted bg-muted/20"
    switch (group.condition) {
      case "AND":
        return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
      case "OR":
        return "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30"
      case "NOT":
        return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
      default:
        return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
    }
  }

  const getConditionColor = () => {
    switch (group.condition) {
      case "AND":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "OR":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "NOT":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
    }
  }

  return (
    <TooltipProvider>
      <Card className={`transition-all duration-200 ${getGroupColor()} ${!isEnabled ? "opacity-60" : ""}`}>
        <Collapsible open={!isCollapsed} onOpenChange={toggleCollapsed}>
          <CardHeader className="pb-3">
            <div className="space-y-3">
              {/* First Line: Name and Edit */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 flex-1">
                  {/* Collapse Toggle */}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-0 h-auto">
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>

                  {/* Group Name */}
                  {isEditing ? (
                    <div className="flex items-center space-x-2 flex-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
                        onBlur={handleNameSave}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <h4
                      className="font-medium text-sm cursor-pointer hover:text-primary"
                      onClick={() => setIsEditing(true)}
                    >
                      {group.name}
                    </h4>
                  )}

                  {/* Edit Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="h-8 w-8 p-0">
                        <Settings className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit group name</TooltipContent>
                  </Tooltip>
                </div>

                {/* Row Count Badge */}
                {rowCount !== undefined && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className="rounded-full px-2 py-0.5 bg-green-500/20 text-green-700 dark:text-green-300 hover:bg-green-500/30 ml-1 flex items-center gap-1">
                        <ListFilter className="h-3 w-3" />
                        <span>{rowCount.toLocaleString()} rows</span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Total rows after applying all filter groups up to this one
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Second Line: Condition and Delete */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {/* Group Condition */}
                  <Select
                    value={group.condition}
                    onValueChange={(value: "AND" | "OR" | "NOT") => onUpdate({ condition: value })}
                    disabled={!isEnabled}
                  >
                    <SelectTrigger className={`w-20 h-8 text-xs ${getConditionColor()}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND</SelectItem>
                      <SelectItem value="OR">OR</SelectItem>
                      <SelectItem value="NOT">NOT</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Filter Count */}
                  <Badge variant="secondary" className="text-xs">
                    {group.filters.length} filter{group.filters.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                {/* Delete Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onRemove}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete group</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Display a compact preview when collapsed */}
            {isCollapsed && group.filters.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center">
                  <Badge variant="outline" className="mr-2">
                    {group.filters.length} filters
                  </Badge>
                  
                  {/* Add row count to collapsed view */}
                  {rowCount !== undefined && (
                    <Badge className="rounded-full px-2 py-0.5 bg-green-500/20 text-green-700 dark:text-green-300 flex items-center gap-1">
                      <ListFilter className="h-3 w-3" />
                      <span>{rowCount.toLocaleString()} rows</span>
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {/* Show first few filters as preview */}
                  {group.filters.slice(0, 3).map((filter, index) => (
                    <span key={filter.id} className="flex items-center">
                      <Badge variant="outline" className="font-mono">
                        {filter.column} {filter.operator} {filter.value}
                      </Badge>
                      {index < Math.min(group.filters.length - 1, 2) && (
                        <span className="mx-1 text-muted-foreground">
                          {group.condition === "NOT" ? "AND" : group.condition}
                        </span>
                      )}
                    </span>
                  ))}
                  {group.filters.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{group.filters.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-3">
              {group.filters.map((filter, index) => (
                <div key={filter.id}>
                  <FilterBuilder
                    filter={filter}
                    columns={columns}
                    onUpdate={(updates) => updateFilter(filter.id, updates)}
                    onRemove={() => removeFilter(filter.id)}
                    disabled={!isEnabled}
                  />
                  {index < group.filters.length - 1 && (
                    <div className="flex justify-center py-2">
                      <Badge variant="secondary" className={`text-xs ${getConditionColor()}`}>
                        {group.condition === "NOT" ? "AND" : group.condition}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}

              {group.filters.length === 0 && (
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed border-muted rounded-lg">
                  <span className="h-8 w-8 mx-auto mb-2 opacity-50">Filter</span>
                  <p className="text-sm">No filters in this group</p>
                  <p className="text-xs">Click the button below to add your first filter</p>
                </div>
              )}

              <Separator />

              <Button variant="outline" size="sm" onClick={addFilter} className="w-full" disabled={!isEnabled}>
                <Plus className="h-3 w-3 mr-2" />
                Add Filter
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </TooltipProvider>
  )
}
