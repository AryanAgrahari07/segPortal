"use client"

import { useState, useEffect } from "react"
import { cva } from "class-variance-authority"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Database, Play, Save, Plus, FilterIcon, Code, Calendar as CalendarIcon, ArrowLeft, Layers, Zap, Eye, Download, BarChart, PieChart, ChevronFirst, ChevronLeft, ChevronRight, ChevronLast, Clock, ChevronDown } from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { FilterGroupBuilder } from "@/components/segment/filter-group-builder"
import { DataTable } from "@/components/segment/data-table"
import { SqlEditor } from "@/components/segment/sql-editor"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { dataService } from "@/services/data-service"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Add calendar and popover imports
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
// Import required types from react-day-picker
import { DayPicker, CaptionProps } from "react-day-picker"

interface Column {
  name: string
  type: string
  nullable: boolean
}

interface FilterGroup {
  id: string
  name: string
  condition: "AND" | "OR" | "NOT"
  filters: any[]
  isCollapsed?: boolean
  isEnabled?: boolean
}

interface SegmentData {
  name: string
  description: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  segment_name?: string
  segment_config?: SegmentConfig
  filter_groups?: any[]
  groupConditions?: string[]
  custom_sql?: string
  generated_sql?: string
}

interface SegmentConfig {
  target_table: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  groupConditions?: string[];
  filterGroups?: any[];
}

interface TableMetadataResponse {
  success?: boolean;
  data?: {
    tableName: string;
    columns: Array<{
      col_name?: string;
      name?: string;
      data_type?: string;
      type?: string;
      nullable?: boolean;
      comment?: string | null;
    }>;
  };
  message?: string;
}

interface ParsedFilter {
  column: string;
  operator: string;
  value: any;
  value2?: any;
}

interface ParsedFilterGroup {
  logic_operator: 'AND' | 'OR';
  filters: ParsedFilter[];
}

interface ApiFilterGroup {
  group_name: string
  group_order: number
  group_condition: "AND" | "OR" 
  description?: string
  not?: boolean
  between_group_condition?: string
  filters: {
    column_name: string
    column_data_type: string
    filter_operator: string
    filter_value: any
    filter_value_2?: any
    filter_order: number
    is_active: boolean
  }[]
}

const convertSqlToFilters = (sql: string): any[] => {
  // This is a placeholder function that doesn't actually parse SQL
  // Instead, we'll send the raw SQL to the backend
  return [];
};

// Define gradient card styles for consistent UI
const gradientCardStyles = cva(
  "bg-gradient-to-br transition-all duration-300 hover:shadow-md",
  {
    variants: {
      variant: {
        primary: "from-primary/5 to-primary/10 border-primary/20 hover:border-primary/30",
        secondary: "from-secondary/5 to-secondary/10 border-secondary/20 hover:border-secondary/30",
        accent: "from-orange-500/5 to-orange-600/10 border-orange-500/20 hover:border-orange-500/30",
        info: "from-blue-500/5 to-blue-600/10 border-blue-500/20 hover:border-blue-500/30",
        success: "from-green-500/5 to-green-600/10 border-green-500/20 hover:border-green-500/30",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
)

const validateSql = (sql: string, tableName: string): { isValid: boolean; error?: string } => {
  try {
    // Basic security checks
    const lowerSql = sql.toLowerCase();
    const dangerousKeywords = ['drop', 'delete', 'update', 'insert', 'alter', 'truncate'];
    
    // Check if any dangerous keyword is present as a standalone word
    if (dangerousKeywords.some(keyword => 
      new RegExp(`\\b${keyword}\\b`).test(lowerSql)
    )) {
      return { 
        isValid: false, 
        error: 'Only SELECT queries are allowed for security reasons' 
      };
    }

    // Check that it's a SELECT query
    if (!lowerSql.trim().startsWith('select')) {
      return {
        isValid: false,
        error: 'Query must start with SELECT'
      };
    }

    // Check that it references the current table
    // Escape special regex characters in tableName
    const escapedTableName = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Create a regex that matches the table name with optional quotes, brackets, etc.
    const tableRegexPattern = `\\bfrom\\s+(?:\\[|"|'|\`)?${escapedTableName}(?:\\]|"|'|\`)?\\b`;
    const tableRegex = new RegExp(tableRegexPattern, 'i');
    
    if (!tableRegex.test(lowerSql)) {
      return {
        isValid: false,
        error: `Query must reference the current table: ${tableName}`
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('SQL Validation Error:', error);
    return { 
      isValid: false, 
      error: 'Invalid SQL syntax. Please check your query.' 
    };
  }
};

// Update the parseWhereClauseToFilters function to handle parentheses properly
const parseWhereClauseToFilters = (sql: string): any => {
  try {
    // Extract WHERE clause
    const whereMatch = sql.toLowerCase().match(/\s+where\s+(.*?)(?:\s+order\s+by|\s+group\s+by|\s+limit|\s*$)/i);
    if (!whereMatch || !whereMatch[1]) {
      return { filterGroups: [] };
    }

    const whereClause = whereMatch[1].trim();
    // console.log("Extracted WHERE clause:", whereClause);
    
    // Simple parsing for basic conditions
    // This is a simplified approach - a real implementation would need a proper SQL parser
    
    // Check for AND/OR conditions
    let logicOperator = 'AND';
    if (whereClause.toLowerCase().includes(' or ')) {
      logicOperator = 'OR';
    }
    
    // Split by AND or OR (this is simplified and won't handle nested conditions properly)
    const separator = logicOperator === 'AND' ? /\s+and\s+/i : /\s+or\s+/i;
    const conditions = whereClause.split(separator);
    
    // Parse each condition into a filter
    const filters = conditions.map(condition => {
      // Remove surrounding parentheses if present
      let trimmedCondition = condition.trim();
      trimmedCondition = trimmedCondition.replace(/^\s*\(\s*|\s*\)\s*$/g, '');
      
      // Handle various operators
      let column = '';
      let operator = '';
      let value: any = '';
      
      // Check for different operators
      if (trimmedCondition.includes('=')) {
        [column, value] = trimmedCondition.split('=').map(s => s.trim());
        operator = 'equals';
      } else if (trimmedCondition.includes('!=')) {
        [column, value] = trimmedCondition.split('!=').map(s => s.trim());
        operator = 'notEquals';
      } else if (trimmedCondition.includes('>=')) {
        [column, value] = trimmedCondition.split('>=').map(s => s.trim());
        operator = 'greaterThanOrEqual';
      } else if (trimmedCondition.includes('<=')) {
        [column, value] = trimmedCondition.split('<=').map(s => s.trim());
        operator = 'lessThanOrEqual';
      } else if (trimmedCondition.includes('>')) {
        [column, value] = trimmedCondition.split('>').map(s => s.trim());
        operator = 'greaterThan';
      } else if (trimmedCondition.includes('<')) {
        [column, value] = trimmedCondition.split('<').map(s => s.trim());
        operator = 'lessThan';
      } else if (trimmedCondition.toLowerCase().includes(' like ')) {
        [column, value] = trimmedCondition.split(/\s+like\s+/i).map(s => s.trim());
        operator = 'contains';
        // Remove % wildcards
        value = value.replace(/^'%|%'$/g, '').replace(/^"|"$/g, '');
      } else if (trimmedCondition.toLowerCase().includes(' in ')) {
        [column, value] = trimmedCondition.split(/\s+in\s+/i).map(s => s.trim());
        operator = 'in';
        // Extract values from IN clause
        const inMatch = value.match(/\(\s*(.*?)\s*\)/);
        if (inMatch && inMatch[1]) {
          value = inMatch[1].split(',').map((v: string) => 
            v.trim().replace(/^'|'$/g, '').replace(/^"|"$/g, '')
          );
        }
      } else if (trimmedCondition.toLowerCase().includes(' between ')) {
        const betweenMatch = trimmedCondition.match(/(.+?)\s+between\s+(.+?)\s+and\s+(.+)/i);
        if (betweenMatch) {
          column = betweenMatch[1].trim();
          operator = 'between';
          const val1 = betweenMatch[2].trim().replace(/^'|'$/g, '').replace(/^"|"$/g, '');
          const val2 = betweenMatch[3].trim().replace(/^'|'$/g, '').replace(/^"|"$/g, '');
          value = [val1, val2];
        }
      } else if (trimmedCondition.toLowerCase().includes(' is null')) {
        column = trimmedCondition.split(/\s+is\s+null/i)[0].trim();
        operator = 'isNull';
      } else if (trimmedCondition.toLowerCase().includes(' is not null')) {
        column = trimmedCondition.split(/\s+is\s+not\s+null/i)[0].trim();
        operator = 'isNotNull';
      }
      
      // Clean up values - remove quotes
      if (typeof value === 'string') {
        value = value.replace(/^'|'$/g, '').replace(/^"|"$/g, '');
      }
      
      // Clean up column name - remove any remaining parentheses
      column = column.replace(/[()]/g, '').trim();
      
      return {
        type: 'condition',
        column,
        operator,
        value
      };
    });
    
    return {
      filterGroups: [{
        logic_operator: logicOperator,
        filters: filters.filter(f => f.column && f.operator)
      }]
    };
  } catch (error) {
    console.error("Error parsing SQL to filters:", error);
    return { filterGroups: [] };
  }
};

// Add a DatePicker component function at the appropriate place, before the TableDetailPage component
function DatePicker({ 
  date, 
  setDate, 
  className 
}: { 
  date: string, 
  setDate: (date: string) => void,
  className?: string 
}) {
  // Handle converting string date to Date object for Calendar
  const selectedDate = date ? new Date(date) : undefined;
  const [month, setMonth] = useState<Date | undefined>(selectedDate || new Date());
  
  // Generate years for dropdown (10 years before and after current year)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  // Handle date selection
  const handleSelect = (newDate: Date | undefined) => {
    if (newDate) {
      // Format date as YYYY-MM-DD
      const formattedDate = newDate.toISOString().split('T')[0];
      setDate(formattedDate);
    }
  };

  // Handle year change
  const handleYearChange = (year: string) => {
    const newDate = new Date(month || new Date());
    newDate.setFullYear(parseInt(year));
    setMonth(newDate);
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString(undefined, options);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-9 border-blue-500/20 focus-visible:ring-blue-500/30",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
          {date ? formatDate(selectedDate!) : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b border-border/20 flex justify-between items-center">
          <span className="text-sm font-medium">Go to year</span>
          <Select value={(month?.getFullYear() || currentYear).toString()} onValueChange={handleYearChange}>
            <SelectTrigger className="h-8 w-[5rem] px-2 text-xs border-blue-500/20 focus-visible:ring-blue-500/30">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()} className="text-xs">
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={month}
          onMonthChange={setMonth}
          initialFocus
          className="border-none shadow-none"
          classNames={{
            caption: "flex justify-center py-2 relative items-center",
            caption_label: "text-sm font-medium",
            cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
            day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-blue-100 dark:hover:bg-blue-900/20",
            day_selected: "bg-blue-500 text-white hover:bg-blue-400 hover:text-white focus:bg-blue-500 focus:text-white",
            day_today: "bg-blue-100 text-blue-700 dark:bg-blue-800/30 dark:text-blue-300",
            head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-blue-500"
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// Add a TimePicker component
function TimePicker({
  time,
  setTime,
  className
}: {
  time: string,
  setTime: (time: string) => void,
  className?: string
}) {
  // Parse current time into hours and minutes
  const [hours, minutes] = time ? time.split(":").map(Number) : [0, 0];

  // Handle hour and minute changes
  const handleHourChange = (newHour: string) => {
    const formattedHour = newHour.padStart(2, '0');
    const formattedMinute = minutes.toString().padStart(2, '0');
    setTime(`${formattedHour}:${formattedMinute}`);
  };

  const handleMinuteChange = (newMinute: string) => {
    const formattedHour = hours.toString().padStart(2, '0');
    const formattedMinute = newMinute.padStart(2, '0');
    setTime(`${formattedHour}:${formattedMinute}`);
  };

  // Generate hour and minute options
  const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="w-full flex items-center h-9 px-3 py-2 rounded-md border border-blue-500/20 bg-transparent text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2">
        <Clock className="mr-2 h-4 w-4 text-blue-500" />
        <div className="flex items-center">
          <Select value={hours.toString().padStart(2, '0')} onValueChange={handleHourChange}>
            <SelectTrigger className="w-[4rem] h-7 px-2 text-center border-0 focus:ring-0 shadow-none">
              <SelectValue placeholder="HH" />
            </SelectTrigger>
            <SelectContent>
              {hourOptions.map((hour) => (
                <SelectItem key={hour} value={hour}>
                  {hour}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="mx-1">:</span>
          <Select value={minutes.toString().padStart(2, '0')} onValueChange={handleMinuteChange}>
            <SelectTrigger className="w-[4rem] h-7 px-2 text-center border-0 focus:ring-0 shadow-none">
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent>
              {minuteOptions.map((minute) => (
                <SelectItem key={minute} value={minute}>
                  {minute}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export default function TableDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const tableName = params?.tableName as string
  const segmentId = searchParams?.get("segment")

  // State management
  const [columns, setColumns] = useState<Column[]>([])
  const [tableData, setTableData] = useState<any[]>([])
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([])
  const [betweenGroupConditions, setBetweenGroupConditions] = useState<string[]>([])
  const [segmentData, setSegmentData] = useState<SegmentData>({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    startTime: "00:00",
    endTime: "23:59",
  })
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSqlEditor, setShowSqlEditor] = useState(false)
  const [generatedSql, setGeneratedSql] = useState("")
  const [customSql, setCustomSql] = useState("")
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showReportOverview, setShowReportOverview] = useState(false)
  const [reportStats, setReportStats] = useState<any>({})
  const [showDataTable, setShowDataTable] = useState(true)
  const [filterGroupRowCounts, setFilterGroupRowCounts] = useState<Record<string, number>>({})
  
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    totalPages: 1,
    total: 0
  })

  useEffect(() => {
    loadTableData()
  }, [tableName, segmentId])

  useEffect(() => {
    executeQuery();
  }, [pagination.page, pagination.pageSize])

  const loadTableData = async () => {
    try {
      setLoading(true);

      // Load table metadata
      try {
        const response = await dataService.getTableMetadata(tableName) as any;
        // console.log("Table metadata response:", response);
        
        // Extract columns from the response
        let columnsData: any[] = [];
        
        if (response && typeof response === 'object') {
          if (response.success && response.data && response.data.columns) {
            columnsData = response.data.columns;
          } else if (response.columns && Array.isArray(response.columns)) {
            columnsData = response.columns;
          }
        }
        
        if (columnsData.length > 0) {
          // Transform column format if needed (col_name to name, data_type to type)
          const formattedColumns = columnsData.map((col: any) => {
            // Normalize the type to match our expected types
            let normalizedType = (col.data_type || col.type || "STRING").toUpperCase();
            
            // Map common database types to our standard types
            switch (normalizedType) {
              case "VARCHAR":
              case "CHAR":
              case "TEXT":
              case "NVARCHAR":
              case "NCHAR":
                normalizedType = "STRING";
                break;
              case "INT":
              case "BIGINT":
              case "SMALLINT":
              case "TINYINT":
              case "NUMBER":
                normalizedType = "INTEGER";
                break;
              case "FLOAT":
              case "DOUBLE":
              case "DECIMAL":
              case "NUMERIC":
                normalizedType = "DECIMAL";
                break;
              case "DATE":
              case "DATETIME":
              case "TIMESTAMP":
                normalizedType = "TIMESTAMP";
                break;
              case "BOOL":
              case "BOOLEAN":
                normalizedType = "BOOLEAN";
                break;
              default:
                normalizedType = "STRING";
            }

            return {
              name: col.col_name || col.name || "",
              type: normalizedType,
              nullable: col.nullable !== undefined ? col.nullable : true
            };
          });
          
          // console.log("Formatted columns:", formattedColumns);
          setColumns(formattedColumns);
        } else {
          console.error("No columns found in metadata:", response);
          setColumns([]);
        }
      } catch (metadataError) {
        console.error("Error loading table metadata:", metadataError);
        setColumns([]);
        toast({
          title: "Error",
          description: "Failed to load table metadata",
          variant: "destructive",
        });
      }

      // If segment ID is provided, load segment data
      if (segmentId) {
        try {
          // console.log("Loading segment data for segment ID:", segmentId);
          const segmentResponse = await dataService.getSegmentById(segmentId, ["filter_groups", "filters"]);
          // console.log("Segment response:", segmentResponse);

          if (!segmentResponse || !segmentResponse.data) {
            throw new Error("Invalid segment data received");
          }

          const segment = segmentResponse.data as unknown as SegmentData;

          // Convert API filter groups to our format
          if (segment.filter_groups) {
            const convertedGroups = segment.filter_groups.map((group) => ({
              id: group.id || `group-${Date.now()}-${Math.random()}`,
              name: group.group_name || "Unnamed Group",
              condition: group.group_condition || "AND",
              isCollapsed: false,
              isEnabled: true,
              filters:
                group.filters?.map((filter: any) => ({
                  id: filter.id || `filter-${Date.now()}-${Math.random()}`,
                  column: filter.column_name || "",
                  operator: filter.filter_operator || "=",
                  value: filter.filter_value || "",
                  value2: filter.filter_value_2 || "",
                })) || [],
            }));

            setFilterGroups(convertedGroups as FilterGroup[]);
            
            // Set between-group conditions if available
            if (segment.groupConditions && Array.isArray(segment.groupConditions)) {
              setBetweenGroupConditions(segment.groupConditions);
            }
            
            // Set segment data
            setSegmentData({
              name: segment.segment_name || "",
              description: segment.description || "",
              startDate: segment.segment_config?.start_date || "",
              endDate: segment.segment_config?.end_date || "",
              startTime: segment.segment_config?.start_time || "00:00",
              endTime: segment.segment_config?.end_time || "23:59",
            });

            // Set custom SQL if available
            if (segment.custom_sql) {
              setCustomSql(segment.custom_sql);
              setGeneratedSql(segment.custom_sql);
            } else if (segment.generated_sql) {
              setGeneratedSql(segment.generated_sql);
            }

            // Load table data with segment filters
            try {
              // console.log("Loading table data with segment filters");
              
              // Format filters according to backend's expected format
              const filterQueryData = {
                filterGroups: convertedGroups.map((group) => ({
                  logic_operator: group.condition,
                  filters: group.filters.map((filter: any) => ({
                    type: 'condition',
                    column: filter.column,
                    operator: mapOperatorToBackend(filter.operator),
                    value: filter.operator === 'BETWEEN' ? [filter.value, filter.value2] : 
                           filter.operator === 'IN' ? filter.value.split(',').map((v: string) => v.trim()) :
                           filter.value
                  }))
                })),
                // Include between-group conditions if available
                groupConditions: segment.groupConditions && Array.isArray(segment.groupConditions) ? 
                  segment.groupConditions : ['AND'],
                page: pagination.page,
                pageSize: pagination.pageSize
              };
              
              // console.log("Sending filter data to load table data:", filterQueryData);
              const tableDataResponse = await dataService.getTableData(tableName, filterQueryData);
              // console.log("Table data response with filters:", tableDataResponse);
              
              // Process the response
              let tableRows = [];
              let paginationData = {
                page: pagination.page,
                pageSize: pagination.pageSize,
                total: 0,
                totalPages: 1
              };
              
              if (tableDataResponse && typeof tableDataResponse === 'object') {
                if (tableDataResponse.success && tableDataResponse.data) {
                  if (tableDataResponse.data.rows) {
                    tableRows = tableDataResponse.data.rows;
                  }
                  
                  // Extract pagination info
                  if (tableDataResponse.data.pagination) {
                    paginationData = tableDataResponse.data.pagination;
                  }
                } else if (tableDataResponse.rows) {
                  tableRows = tableDataResponse.rows;
                } else if (Array.isArray(tableDataResponse)) {
                  tableRows = tableDataResponse;
                }
              }
              
              setTableData(Array.isArray(tableRows) ? tableRows : []);
              setPagination(prevPagination => ({
                ...prevPagination,
                page: paginationData.page,
                pageSize: paginationData.pageSize,
                total: paginationData.total,
                totalPages: paginationData.totalPages
              }));
            } catch (dataError) {
              console.error("Error loading table data with segment filters:", dataError);
              setTableData([]);
              toast({
                title: "Error",
                description: "Failed to load table data with segment filters",
                variant: "destructive",
              });
              
              // Load regular table data as fallback
              try {
                const data = await dataService.getTableData(tableName, { page: pagination.page, pageSize: pagination.pageSize });
                
                let tableRows = [];
                let paginationData = {
                  page: pagination.page,
                  pageSize: pagination.pageSize,
                  total: 0,
                  totalPages: 1
                };
                
                if (data && typeof data === 'object') {
                  if (data.success && data.data) {
                    tableRows = data.data.rows || [];
                    paginationData = data.data.pagination || paginationData;
                  } else if (data.rows) {
                    tableRows = data.rows;
                  } else if (Array.isArray(data)) {
                    tableRows = data;
                  }
                }
                
                setTableData(Array.isArray(tableRows) ? tableRows : []);
                setPagination(prevPagination => ({
                  ...prevPagination,
                  page: paginationData.page,
                  pageSize: paginationData.pageSize,
                  total: paginationData.total,
                  totalPages: paginationData.totalPages
                }));
              } catch (fallbackError) {
                console.error("Error loading fallback table data:", fallbackError);
                setTableData([]);
              }
            }
          } else {
            console.error("Invalid segment format or missing filter groups:", segment);
            setFilterGroups([]);
            
            // Load regular table data as fallback
            try {
              const data = await dataService.getTableData(tableName, { page: pagination.page, pageSize: pagination.pageSize });
              
              let tableRows = [];
              let paginationData = {
                page: pagination.page,
                pageSize: pagination.pageSize,
                total: 0,
                totalPages: 1
              };
              
              if (data && typeof data === 'object') {
                if (data.success && data.data) {
                  tableRows = data.data.rows || [];
                  paginationData = data.data.pagination || paginationData;
                } else if (data.rows) {
                  tableRows = data.rows;
                } else if (Array.isArray(data)) {
                  tableRows = data;
                }
              }
              
              setTableData(Array.isArray(tableRows) ? tableRows : []);
              setPagination(prevPagination => ({
                ...prevPagination,
                page: paginationData.page,
                pageSize: paginationData.pageSize,
                total: paginationData.total,
                totalPages: paginationData.totalPages
              }));
            } catch (dataError) {
              console.error("Error loading fallback table data:", dataError);
              setTableData([]);
            }
          }
        } catch (error) {
          console.error("Error loading segment:", error);
          toast({
            title: "Error",
            description: "Failed to load segment data",
            variant: "destructive",
          });

          // Load regular table data as fallback
          try {
            const data = await dataService.getTableData(tableName, { page: pagination.page, pageSize: pagination.pageSize });
            
            let tableRows = [];
            let paginationData = {
              page: pagination.page,
              pageSize: pagination.pageSize,
              total: 0,
              totalPages: 1
            };
            
            if (data && typeof data === 'object') {
              if (data.success && data.data) {
                tableRows = data.data.rows || [];
                paginationData = data.data.pagination || paginationData;
              } else if (data.rows) {
                tableRows = data.rows;
              } else if (Array.isArray(data)) {
                tableRows = data;
              }
            }
            
            setTableData(Array.isArray(tableRows) ? tableRows : []);
            setPagination(prevPagination => ({
              ...prevPagination,
              page: paginationData.page,
              pageSize: paginationData.pageSize,
              total: paginationData.total,
              totalPages: paginationData.totalPages
            }));
          } catch (dataError) {
            console.error("Error loading fallback table data:", dataError);
            setTableData([]);
          }
        }
      } else {
        // Load regular table data
        try {
          const response = await dataService.getTableData(tableName, { page: pagination.page, pageSize: pagination.pageSize });
          // console.log("Table data response:", response);
          
          // Handle nested response structure with rows property
          let tableRows = [];
          let paginationData = {
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: 0,
            totalPages: 1
          };
          
          if (response && typeof response === 'object') {
            if (response.success && response.data) {
              // Check if data has rows property
              tableRows = response.data.rows || response.data;
              
              // Extract pagination info
              if (response.data.pagination) {
                paginationData = response.data.pagination;
              }
            } else if (response.rows) {
              // Direct rows property
              tableRows = response.rows;
            } else if (Array.isArray(response)) {
              tableRows = response;
            } else {
              tableRows = [];
            }
          }
          
          // console.log("Processed table rows:", tableRows);
          setTableData(Array.isArray(tableRows) ? tableRows : []);
          setPagination(prevPagination => ({
            ...prevPagination,
            page: paginationData.page,
            pageSize: paginationData.pageSize,
            total: paginationData.total,
            totalPages: paginationData.totalPages
          }));
        } catch (dataError) {
          console.error("Error loading table data:", dataError);
          setTableData([]);
          toast({
            title: "Error",
            description: "Failed to load table data",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load table data",
        variant: "destructive",
      });
      setTableData([]);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  };

  const addFilterGroup = () => {
    const newGroup: FilterGroup = {
      id: `group_${Date.now()}`,
      name: `Filter Group ${filterGroups.length + 1}`,
      condition: "AND",
      filters: [],
      isCollapsed: false,
      isEnabled: true,
    }
    
    // Add a default between-group condition (AND) when adding a new group
    if (filterGroups.length > 0) {
      setBetweenGroupConditions((prev) => [...prev, "AND"])
    }
    
    setFilterGroups([...filterGroups, newGroup])
  }

  const updateFilterGroup = (groupId: string, updates: Partial<FilterGroup>) => {
    setFilterGroups((groups) => groups.map((group) => (group.id === groupId ? { ...group, ...updates } : group)))
  }

  const removeFilterGroup = (groupId: string) => {
    const index = filterGroups.findIndex(g => g.id === groupId)
    
    // Remove the corresponding between-group condition if needed
    if (index >= 0) {
      if (index === filterGroups.length - 1 && index > 0) {
        // If removing the last group, remove the last between-group condition
        setBetweenGroupConditions(prev => prev.slice(0, -1))
      } else if (index < filterGroups.length - 1) {
        // If removing a group in the middle, remove its between-group condition
        setBetweenGroupConditions(prev => {
          const newConditions = [...prev]
          newConditions.splice(index, 1)
          return newConditions
        })
      }
    }
    
    setFilterGroups((groups) => groups.filter((group) => group.id !== groupId))
  }

  const updateBetweenGroupCondition = (index: number, condition: string) => {
    setBetweenGroupConditions(prev => {
      const newConditions = [...prev]
      newConditions[index] = condition
      return newConditions
    })
  }

  const duplicateFilterGroup = (groupId: string) => {
    const groupToDuplicate = filterGroups.find((g) => g.id === groupId)
    if (groupToDuplicate) {
      const newGroup: FilterGroup = {
        ...groupToDuplicate,
        id: `group_${Date.now()}`,
        name: `${groupToDuplicate.name} (Copy)`,
        filters: groupToDuplicate.filters.map((filter) => ({
          ...filter,
          id: `filter_${Date.now()}_${Math.random()}`,
        })),
      }
      setFilterGroups([...filterGroups, newGroup])
    }
  }

  const generateSqlFromFilters = () => {
    if (filterGroups.length === 0) {
      return `SELECT * FROM ${tableName} LIMIT 1000`
    }

    let whereClause = ""
    const enabledGroups = filterGroups.filter((group) => group.isEnabled !== false)
    const groupClauses = enabledGroups
      .map((group) => {
        if (group.filters.length === 0) return ""

        const filterClauses = group.filters
          .map((filter) => {
            let clause = ""
            switch (filter.operator) {
              case "=":
              case "!=":
              case ">":
              case ">=":
              case "<":
              case "<=":
                clause = `${filter.column} ${filter.operator} '${filter.value}'`
                break
              case "BETWEEN":
                clause = `${filter.column} BETWEEN '${filter.value}' AND '${filter.value2}'`
                break
              case "NOT_BETWEEN":
                clause = `${filter.column} NOT BETWEEN '${filter.value}' AND '${filter.value2}'`
                break
              case "IN":
                const inValues = filter.value
                  .split(",")
                  .map((v: string) => `'${v.trim()}'`)
                  .join(",")
                clause = `${filter.column} IN (${inValues})`
                break
              case "NOT_IN":
                const notInValues = filter.value
                  .split(",")
                  .map((v: string) => `'${v.trim()}'`)
                  .join(",")
                clause = `${filter.column} NOT IN (${notInValues})`
                break
              case "LIKE":
                clause = `${filter.column} LIKE '%${filter.value}%'`
                break
              case "NOT LIKE":
                clause = `${filter.column} NOT LIKE '%${filter.value}%'`
                break
              case "STARTS_WITH":
                clause = `${filter.column} LIKE '${filter.value}%'`
                break
              case "NOT_STARTS_WITH":
                clause = `${filter.column} NOT LIKE '${filter.value}%'`
                break
              case "ENDS_WITH":
                clause = `${filter.column} LIKE '%${filter.value}'`
                break
              case "NOT_ENDS_WITH":
                clause = `${filter.column} NOT LIKE '%${filter.value}'`
                break
              case "IS NULL":
                clause = `${filter.column} IS NULL`
                break
              case "IS NOT NULL":
                clause = `${filter.column} IS NOT NULL`
                break
            }
            return clause
          })
          .filter(Boolean)

        if (filterClauses.length === 0) return ""
        
        // Handle NOT condition for the group - use AND internally for conditions
        // and wrap the entire group in NOT()
        if (group.condition === "NOT") {
          return `NOT (${filterClauses.join(" AND ")})`
        }
        return `(${filterClauses.join(` ${group.condition} `)})`
      })
      .filter(Boolean)

    if (groupClauses.length > 0) {
      // Use between-group conditions if available, otherwise default to AND
      if (groupClauses.length > 1 && betweenGroupConditions.length > 0) {
        let finalClause = groupClauses[0]
        
        for (let i = 1; i < groupClauses.length; i++) {
          const condition = i - 1 < betweenGroupConditions.length 
            ? betweenGroupConditions[i - 1] 
            : "AND"
          finalClause += ` ${condition} ${groupClauses[i]}`
        }
        
        whereClause = ` WHERE ${finalClause}`
      } else {
        whereClause = ` WHERE ${groupClauses.join(" AND ")}`
      }
    }

    return `SELECT * FROM ${tableName}${whereClause} LIMIT 1000`
  }

  // Fetch insights data from the backend API
  const fetchInsightsData = async () => {
    if (!tableName) {
      return;
    }

    try {
      setReportStats({}); // Clear previous stats
      
      let insightsResponse;
      
      // Use different approaches based on what we have
      if (segmentId) {
        // If we have a segment ID, use it to fetch insights
        // console.log("Fetching insights using segment:", segmentId);
        insightsResponse = await dataService.getTableInsightsWithSegment(tableName, segmentId);
      } else if (customSql) {
        // If we have custom SQL, use it
        // console.log("Fetching insights using custom SQL");
        insightsResponse = await dataService.getTableInsights(tableName, {
          customSql
        });
      } else if (filterGroups && filterGroups.length > 0) {
        // Format filters for the API
        const formattedFilterGroups = filterGroups
          .filter((group) => group.isEnabled !== false)
          .map((group) => ({
            logic_operator: group.condition === "NOT" ? "AND" : group.condition,
            not: group.condition === "NOT",
            filters: group.filters.map((filter) => ({
              type: 'condition',
              column: filter.column,
              operator: mapOperatorToBackend(filter.operator),
              value: filter.operator === 'BETWEEN' || filter.operator === 'NOT_BETWEEN' 
                ? [filter.value, filter.value2] 
                : filter.operator === 'IN' || filter.operator === 'NOT_IN' 
                  ? filter.value.split(',').map((v: string) => v.trim()) 
                  : filter.value
            }))
          }));
          
        // console.log("Fetching insights using filter groups");
        insightsResponse = await dataService.getTableInsights(tableName, {
          filterGroups: formattedFilterGroups,
          groupConditions: betweenGroupConditions.length > 0 ? betweenGroupConditions : ['AND']
        });
      } else {
        // Fetch insights for the whole table without filters
        // console.log("Fetching insights for entire table");
        insightsResponse = await dataService.getTableInsights(tableName);
      }
      
      // Process response
      if (insightsResponse && insightsResponse.success && insightsResponse.data) {
        // console.log("Insights data received:", insightsResponse.data);
        setReportStats(insightsResponse.data);
      } else {
        console.error("Invalid insights response:", insightsResponse);
        setReportStats({
          totalRecords: tableData?.length || 0,
          numericColumns: {},
          categoricalColumns: {},
          dateColumns: {},
          summary: {
            missingValues: {},
            correlations: [],
            mostCommonValues: [],
            outliers: [],
            distributions: {},
            trends: {}
          }
        });
      }
    } catch (error) {
      console.error("Error fetching insights data:", error);
      setReportStats({
        totalRecords: tableData?.length || 0,
        numericColumns: {},
        categoricalColumns: {},
        dateColumns: {},
        summary: {
          missingValues: {},
          correlations: [],
          mostCommonValues: [],
          outliers: [],
          distributions: {},
          trends: {}
        }
      });
    }
  }

  // Update report stats whenever tableData changes by fetching insights from backend
  useEffect(() => {
    if (tableData && tableData.length > 0) {
      // Call fetchInsightsData instead of generating stats on the frontend
      fetchInsightsData();
    }
  }, [tableData])

  const executeQuery = async () => {
    setExecuting(true);
    try {
      if (customSql) {
        // Handle custom SQL
        const validation = validateSql(customSql, tableName);
        if (!validation.isValid) {
          toast({
            title: "Invalid SQL",
            description: validation.error || "Please check your SQL query",
            variant: "destructive",
          });
          setExecuting(false);
          return;
        }
        
        setGeneratedSql(customSql);
        
        // Execute query with custom SQL
        // The backend will handle parsing the SQL
        const customResponse = await dataService.getTableData(tableName, { 
          customSql,
          filterGroups: [],
          page: pagination.page,
          pageSize: pagination.pageSize
        });
        
        // Handle response
        let customTableRows: any[] = [];
        let paginationData = {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: 0,
          totalPages: 1
        };
        
        if (customResponse && typeof customResponse === 'object') {
          if (customResponse.success && customResponse.data) {
            customTableRows = customResponse.data.rows || [];
            
            // Extract pagination info
            if (customResponse.data.pagination) {
              paginationData = customResponse.data.pagination;
            }
          } else if (customResponse.rows) {
            customTableRows = customResponse.rows;
          } else if (Array.isArray(customResponse)) {
            customTableRows = customResponse;
          }
        }
        
        setTableData(Array.isArray(customTableRows) ? customTableRows : []);
        setPagination(prevPagination => ({
          ...prevPagination,
          page: paginationData.page,
          pageSize: paginationData.pageSize,
          total: paginationData.total,
          totalPages: paginationData.totalPages
        }));
        
        // Fetch insights data from backend
        fetchInsightsData();
        
        toast({
          title: "Query Executed",
          description: `Found ${paginationData.total} records, showing page ${paginationData.page} of ${paginationData.totalPages}`,
        });

        // Reset filter group row counts since we're using custom SQL
        setFilterGroupRowCounts({});
      } else {
        // Use existing filter groups
        const sql = generateSqlFromFilters();
        setGeneratedSql(sql);
        
        // Format filters according to backend's expected format
        const filterQueryData = {
          filterGroups: filterGroups
            .filter((group) => group.isEnabled !== false)
            .map((group) => ({
              logic_operator: group.condition === "NOT" ? "AND" : group.condition,
              not: group.condition === "NOT", // Set NOT flag for NOT condition
              filters: group.filters.map((filter) => ({
                type: 'condition',
                column: filter.column,
                operator: mapOperatorToBackend(filter.operator),
                value: filter.operator === 'BETWEEN' || filter.operator === 'NOT_BETWEEN' 
                  ? [filter.value, filter.value2] 
                  : filter.operator === 'IN' || filter.operator === 'NOT_IN' 
                    ? filter.value.split(',').map((v: string) => v.trim()) 
                    : filter.value
              }))
            })),
          // Add the between-group conditions as an array
          groupConditions: betweenGroupConditions.length > 0 ? betweenGroupConditions : ['AND'],
          page: pagination.page,
          pageSize: pagination.pageSize
        };
        
        // console.log("Executing query with filters:", filterQueryData);
        
        // Execute query
        const filterResponse = await dataService.getTableData(tableName, filterQueryData);
        
        // Handle response
        let filterTableRows: any[] = [];
        let paginationData = {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: 0,
          totalPages: 1
        };
        
        if (filterResponse && typeof filterResponse === 'object') {
          if (filterResponse.success && filterResponse.data) {
            filterTableRows = filterResponse.data.rows || [];
            
            // Extract pagination info
            if (filterResponse.data.pagination) {
              paginationData = filterResponse.data.pagination;
            }
          } else if (filterResponse.rows) {
            filterTableRows = filterResponse.rows;
          } else if (Array.isArray(filterResponse)) {
            filterTableRows = filterResponse;
          }
        }
        
        setTableData(Array.isArray(filterTableRows) ? filterTableRows : []);
        setPagination(prevPagination => ({
          ...prevPagination,
          page: paginationData.page,
          pageSize: paginationData.pageSize,
          total: paginationData.total,
          totalPages: paginationData.totalPages
        }));
        
        // Fetch insights data from backend
        fetchInsightsData();
        
        toast({
          title: "Query Executed",
          description: `Found ${paginationData.total} records, showing page ${paginationData.page} of ${paginationData.totalPages}`,
        });
        
        // After main query execution, calculate row counts for each filter group
        await calculateFilterGroupRowCounts();
      }
    } catch (error: any) {
      console.error("Error executing query:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to execute query",
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  };

  // Function to calculate row counts for each filter group independently
  const calculateFilterGroupRowCounts = async () => {
    // Only proceed if we have filter groups
    if (filterGroups.length === 0) {
      setFilterGroupRowCounts({});
      return;
    }

    const counts: Record<string, number> = {};
    const enabledGroups = filterGroups.filter(group => group.isEnabled !== false);
    
    // For each enabled group, calculate cumulative counts
    for (let i = 0; i < enabledGroups.length; i++) {
      try {
        // Create a query with groups up to and including the current one
        const cumulativeGroups = enabledGroups.slice(0, i + 1);
        const cumulativeBetweenConditions = betweenGroupConditions.slice(0, i);
        
        const cumulativeQuery = {
          filterGroups: cumulativeGroups.map((group: FilterGroup) => ({
            logic_operator: group.condition === "NOT" ? "AND" : group.condition,
            not: group.condition === "NOT",
            filters: group.filters.map((filter: any) => ({
              type: 'condition',
              column: filter.column,
              operator: mapOperatorToBackend(filter.operator),
              value: filter.operator === 'BETWEEN' || filter.operator === 'NOT_BETWEEN' 
                ? [filter.value, filter.value2] 
                : filter.operator === 'IN' || filter.operator === 'NOT_IN' 
                  ? filter.value.split(',').map((v: string) => v.trim()) 
                  : filter.value
            }))
          })),
          // Add between-group conditions for the groups we're including
          groupConditions: cumulativeBetweenConditions.length > 0 ? cumulativeBetweenConditions : ['AND'],
          // We only need the count, not the actual data
          page: 1,
          pageSize: 1
        };
        
        // Execute query for this cumulative set of filter groups
        const response = await dataService.getTableData(tableName, cumulativeQuery);
        
        // Extract the total count
        let count = 0;
        if (response && typeof response === 'object') {
          if (response.success && response.data && response.data.pagination) {
            count = response.data.pagination.total || 0;
          }
        }
        
        // Store the count with the current group's ID
        counts[enabledGroups[i].id] = count;
      } catch (error) {
        console.error(`Error getting count for filter group ${enabledGroups[i].id}:`, error);
        counts[enabledGroups[i].id] = 0;
      }
    }
    
    // Set any disabled groups to 0
    filterGroups.forEach(group => {
      if (group.isEnabled === false) {
        counts[group.id] = 0;
      }
    });
    
    setFilterGroupRowCounts(counts);
  };
  
  // Remove the useEffect that auto-recalculates on filter change
  // We'll only calculate when "Run Query" is clicked
  useEffect(() => {
    if (!loading && !executing && filterGroups.length > 0) {
      // Initial load only - not on every filter change
      if (Object.keys(filterGroupRowCounts).length === 0) {
        calculateFilterGroupRowCounts();
      }
    }
  }, [loading, executing]);

  // Handle pagination changes
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({
        ...prev,
        page: newPage
      }));
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({
      ...prev,
      page: 1, // Reset to first page when changing page size
      pageSize: newSize
    }));
  };

  // Update the mapOperatorToBackend function to match the backend's operator names
  const mapOperatorToBackend = (operator: string): string => {
    const operatorMap: { [key: string]: string } = {
      '=': 'equals',
      '!=': 'notEquals',
      'LIKE': 'contains',
      'NOT LIKE': 'notContains',
      'STARTS_WITH': 'startsWith',
      'NOT_STARTS_WITH': 'notStartsWith',
      'ENDS_WITH': 'endsWith',
      'NOT_ENDS_WITH': 'notEndsWith',
      '>': 'greaterThan',
      '>=': 'greaterThanOrEqual',
      '<': 'lessThan',
      '<=': 'lessThanOrEqual',
      'IN': 'in',
      'NOT_IN': 'notIn',
      'BETWEEN': 'between',
      'NOT_BETWEEN': 'notBetween',
      'IS NULL': 'isNull',
      'IS NOT NULL': 'isNotNull'
    }
    return operatorMap[operator] || operator
  }

  const saveSegment = async () => {
    if (!segmentData.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a segment name",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Determine which filter groups to use
      let segmentFilterGroups: FilterGroup[] = [];
      let generatedSqlToSave: string;
      let customSqlToSave: string | undefined;

      if (customSql) {
        // For custom SQL, we'll just save the SQL directly
        generatedSqlToSave = customSql;
        customSqlToSave = customSql;
        
        // We'll still need to provide filter groups structure even if empty
        segmentFilterGroups = [];
      } else {
        // Use existing filter groups
        segmentFilterGroups = [...filterGroups];
        generatedSqlToSave = generateSqlFromFilters();
        customSqlToSave = undefined;
      }

      // Convert our filter groups to API format
      const apiFilterGroups = segmentFilterGroups.map((group, index) => {
        // Determine if this is a NOT condition
        const isNotCondition = group.condition === "NOT";
        
        return {
          group_name: group.name || `Group ${index + 1}`,
          group_order: index + 1,
          group_condition: isNotCondition ? "AND" : group.condition,
          not: isNotCondition, // Set NOT flag for NOT condition
          between_group_condition: index > 0 && index - 1 < betweenGroupConditions.length 
            ? betweenGroupConditions[index - 1] 
            : "AND",
          filters: group.filters.map((filter: any, filterIndex: number) => {
            // Determine value format based on operator
            let filterValue = filter.value;
            let filterValue2 = filter.value2;
            
            if (filter.operator === 'BETWEEN' || filter.operator === 'NOT_BETWEEN') {
              filterValue = [filter.value, filter.value2];
              filterValue2 = undefined; // Not needed as we put both values in filterValue as array
            } else if (filter.operator === 'IN' || filter.operator === 'NOT_IN') {
              filterValue = filter.value.split(',').map((v: string) => v.trim());
            }
            
            return {
              column_name: filter.column,
              column_data_type: columns.find((col) => col.name === filter.column)?.type || "STRING",
              filter_operator: mapOperatorToBackend(filter.operator),
              filter_value: filterValue,
              filter_value_2: filterValue2,
              filter_order: filterIndex + 1,
              is_active: true
            };
          }),
        };
      });

      // Get user info for created_by
      let createdBy = "unknown";
      try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          createdBy = user.email || user.first_name + " " + user.last_name || "unknown";
        }
      } catch (e) {
        console.error("Error getting user info:", e);
      }

      // Use 'any' type to avoid TypeScript errors with the complex payload structure
      const segmentPayload: any = {
        segment_name: segmentData.name,
        description: segmentData.description,
        table_id: tableName,
        created_by: createdBy,
        segment_config: {
          target_table: tableName,
          start_date: segmentData.startDate || undefined,
          end_date: segmentData.endDate || undefined,
          start_time: segmentData.startTime || undefined,
          end_time: segmentData.endTime || undefined,
          filterGroups: apiFilterGroups, // Include filter groups in config
          groupConditions: betweenGroupConditions.length > 0 ? betweenGroupConditions : ['AND'] // Use array format
        },
        generated_sql: generatedSqlToSave,
        custom_sql: customSqlToSave,
        is_template: false,
        is_saved_table: true,
        filter_groups: apiFilterGroups,
        status: "active"
      };

      let result;
      
      // Check if we're editing an existing segment
      if (segmentId) {
        // console.log("Updating existing segment:", segmentId);
        result = await dataService.updateSegment(segmentId, segmentPayload);
        // console.log("Segment update result:", result);
        
        toast({
          title: "Success",
          description: "Segment updated successfully",
        });
      } else {
        // Creating a new segment
        // console.log("Creating new segment with payload:", segmentPayload);
        result = await dataService.createSegment(segmentPayload);
        // console.log("Segment creation result:", result);
        
        toast({
          title: "Success",
          description: "Segment created successfully",
        });
      }

      setShowSaveDialog(false);

      // Redirect to segments list
      router.push("/dashboard?tab=segments");
    } catch (error: any) {
      console.error("Error saving segment:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save segment",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetSqlEditor = () => {
    setCustomSql('');
    setGeneratedSql(generateSqlFromFilters());
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Database className="h-12 w-12 animate-pulse mx-auto mb-4 text-muted-foreground" />
            <p>Loading table data...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const enabledFilterCount = filterGroups.filter((g) => g.isEnabled !== false).length
  const totalFilterCount = filterGroups.reduce((sum, group) => sum + group.filters.length, 0)

  // Render the report overview component
  const renderReportOverview = () => {
    if (!reportStats.totalRecords) {
      return (
        <div className="text-center py-4 text-muted-foreground text-sm">
          No data available for report overview.
        </div>
      )
    }

    return (
      <div className="space-y-8">
        {/* Overall Data Summary */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center">
            <Database className="h-5 w-5 mr-2 text-blue-500" />
            Overall Data Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-500/10 rounded-md p-4 border border-blue-500/20">
              <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Total Records</div>
              <div className="text-2xl font-semibold">{reportStats.totalRecords}</div>
            </div>
            {Object.keys(reportStats.numericColumns).length > 0 && (
              <div className="bg-purple-500/10 rounded-md p-4 border border-purple-500/20">
                <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">Numeric Columns</div>
                <div className="text-2xl font-semibold">{Object.keys(reportStats.numericColumns).length}</div>
              </div>
            )}
            {Object.keys(reportStats.categoricalColumns).length > 0 && (
              <div className="bg-orange-500/10 rounded-md p-4 border border-orange-500/20">
                <div className="text-sm text-orange-600 dark:text-orange-400 mb-1">Categorical Columns</div>
                <div className="text-2xl font-semibold">{Object.keys(reportStats.categoricalColumns).length}</div>
              </div>
            )}
            {Object.keys(reportStats.dateColumns).length > 0 && (
              <div className="bg-green-500/10 rounded-md p-4 border border-green-500/20">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">Date Columns</div>
                <div className="text-2xl font-semibold">{Object.keys(reportStats.dateColumns).length}</div>
              </div>
            )}
          </div>
        </div>

        {/* Key Insights */}
        {(reportStats.summary.correlations.length > 0 || 
          reportStats.summary.outliers.length > 0 || 
          Object.keys(reportStats.summary.trends).length > 0) && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center">
              <Zap className="h-5 w-5 mr-2 text-amber-500" />
              Key Insights
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Correlations */}
              {reportStats.summary.correlations.length > 0 && (
                <div className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 rounded-md p-4 border border-amber-500/20">
                  <h4 className="text-base font-medium mb-3 flex items-center">
                    <ArrowLeft className="h-4 w-4 mr-2 text-amber-500 rotate-45" />
                    Column Correlations
                  </h4>
                  <div className="space-y-3">
                    {reportStats.summary.correlations.slice(0, 3).map((corr: any, idx: number) => (
                      <div key={idx} className="flex items-center">
                        <div className="flex-1 flex items-center">
                          <div className="w-2 h-2 rounded-full mr-2" 
                            style={{ 
                              backgroundColor: corr.direction === 'positive' 
                                ? 'rgb(34, 197, 94)' // green-500
                                : 'rgb(239, 68, 68)' // red-500
                            }}
                          />
                          <div className="truncate mr-1" title={corr.columns[0]}>
                            {corr.columns[0]}
                          </div>
                          <span className="mx-1 text-muted-foreground">and</span>
                          <div className="truncate" title={corr.columns[1]}>
                            {corr.columns[1]}
                          </div>
                        </div>
                        <Badge className={`ml-2 ${
                          corr.strength === 'strong' 
                            ? 'bg-amber-500 hover:bg-amber-600' 
                            : corr.strength === 'moderate'
                              ? 'bg-amber-400 hover:bg-amber-500'
                              : 'bg-amber-300 hover:bg-amber-400'
                        }`}>
                          {corr.correlation > 0 ? '+' : ''}{corr.correlation}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  {reportStats.summary.correlations.length > 3 && (
                    <div className="text-sm text-muted-foreground mt-2 text-center">
                      +{reportStats.summary.correlations.length - 3} more correlations
                    </div>
                  )}
                </div>
              )}

              {/* Outliers */}
              {reportStats.summary.outliers.length > 0 && (
                <div className="bg-gradient-to-br from-red-500/5 to-red-500/10 rounded-md p-4 border border-red-500/20">
                  <h4 className="text-base font-medium mb-3 flex items-center">
                    <span className="relative flex h-5 w-5 mr-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-20"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 items-center justify-center text-white text-xs">!</span>
                    </span>
                    Detected Outliers
                  </h4>
                  <div className="space-y-3">
                    {reportStats.summary.outliers.slice(0, 3).map((outlier: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="truncate" title={outlier.column}>
                          {outlier.column}
                        </div>
                        <div className="flex items-center">
                          <Badge variant="outline" className="mr-2 border-red-500/20 text-red-600 dark:text-red-400">
                            {outlier.count} values
                          </Badge>
                          <Badge className="bg-red-500 hover:bg-red-600">
                            {outlier.percentage}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  {reportStats.summary.outliers.length > 3 && (
                    <div className="text-sm text-muted-foreground mt-2 text-center">
                      +{reportStats.summary.outliers.length - 3} more columns with outliers
                    </div>
                  )}
                </div>
              )}

              {/* Trends */}
              {Object.keys(reportStats.summary.trends).length > 0 && (
                <div className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 rounded-md p-4 border border-blue-500/20">
                  <h4 className="text-base font-medium mb-3 flex items-center">
                    <ArrowLeft className={`h-4 w-4 mr-2 text-blue-500 ${
                      reportStats.summary?.trends && 
                      Object.values(reportStats.summary.trends || {}).length > 0 &&
                      (Object.values(reportStats.summary.trends || {})[0] as any)?.trend === 'increasing' 
                        ? 'rotate-45' 
                        : 'rotate-135'
                    }`} />
                    Detected Trends
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(reportStats.summary.trends).slice(0, 3).map(([colName, trend]: [string, any], idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="truncate" title={colName}>
                          {colName}
                        </div>
                        <Badge className={`${
                          trend.trend === 'increasing' 
                            ? 'bg-green-500 hover:bg-green-600' 
                            : 'bg-red-500 hover:bg-red-600'
                        }`}>
                          {trend.trend} trend
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Values */}
              {Object.entries(reportStats.summary.missingValues)
                .filter(([_, stats]: [string, any]) => stats.percentage > 0)
                .length > 0 && (
                <div className="bg-gradient-to-br from-gray-500/5 to-gray-500/10 rounded-md p-4 border border-gray-500/20">
                  <h4 className="text-base font-medium mb-3 flex items-center">
                    <div className="h-4 w-4 mr-2 border border-gray-500 rounded-sm" />
                    Missing Values
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(reportStats.summary.missingValues)
                      .filter(([_, stats]: [string, any]) => stats.percentage > 0)
                      .sort((a: any, b: any) => b[1].percentage - a[1].percentage)
                      .slice(0, 3)
                      .map(([colName, stats]: [string, any], idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="truncate" title={colName}>
                            {colName}
                          </div>
                          <div className="flex items-center">
                            <Badge variant="outline" className="mr-2 border-gray-500/20">
                              {stats.count} values
                            </Badge>
                            <Badge className="bg-gray-500 hover:bg-gray-600">
                              {stats.percentage}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Common Values */}
        {reportStats.summary.mostCommonValues.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-orange-500" />
              Most Common Values
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportStats.summary.mostCommonValues.slice(0, 6).map((item: any, idx: number) => (
                <div key={idx} className="bg-gradient-to-br from-orange-500/5 to-orange-500/10 rounded-md p-4 border border-orange-500/20">
                  <h4 className="text-base font-medium mb-2 truncate" title={item.column}>
                    {item.column}
                  </h4>
                  <div className="space-y-2">
                    {item.values.map((value: any, vidx: number) => (
                      <div key={vidx} className="flex items-center">
                        <div className="w-28 truncate mr-2" title={value.value}>
                          {value.value}
                        </div>
                        <div className="flex-grow bg-muted rounded-full h-2 mr-2">
                          <div 
                            className="bg-orange-500 h-2 rounded-full" 
                            style={{ width: `${value.percentage}%` }}
                          ></div>
                        </div>
                        <div className="text-sm w-12 text-right text-muted-foreground font-medium">
                          {value.percentage}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Column Details Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center">
            <Layers className="h-5 w-5 mr-2 text-primary" />
            Column Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Numeric Columns */}
            {Object.entries(reportStats.numericColumns).map(([colName, stats]: [string, any]) => (
              <div key={colName} className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-md p-4 border border-primary/20 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-medium flex items-center truncate" title={colName}>
                    <BarChart className="h-4 w-4 mr-2 text-primary" />
                    {colName}
                  </h4>
                </div>
                
                {/* Histogram miniature */}
                {stats.distribution && stats.distribution.length > 0 && (
                  <div className="mb-3 h-12 flex items-end">
                    {stats.distribution.map((bucket: any, idx: number) => {
                      const maxCount = Math.max(...stats.distribution.map((b: any) => b.count));
                      const heightPercentage = bucket.count > 0 
                        ? Math.max(15, (bucket.count / maxCount) * 100) 
                        : 0;
                      return (
                        <div 
                          key={idx} 
                          className="flex-1 bg-primary/30 rounded-sm mx-0.5"
                          style={{ height: `${heightPercentage}%` }}
                          title={`${bucket.range[0]} - ${bucket.range[1]}: ${bucket.count} values`}
                        />
                      );
                    })}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-x-4 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Avg:</span>
                    <span className="font-medium">{stats.avg}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Median:</span>
                    <span className="font-medium">{stats.median}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Min:</span>
                    <span className="font-medium">{stats.min}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Max:</span>
                    <span className="font-medium">{stats.max}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">StdDev:</span>
                    <span className="font-medium">{stats.stdDev}</span>
                  </div>
                  {stats.outlierCount > 0 && (
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Outliers:</span>
                      <span className="font-medium text-red-500">{stats.outlierPercentage}%</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Categorical Columns */}
            {Object.entries(reportStats.categoricalColumns).map(([colName, stats]: [string, any]) => (
              <div key={colName} className="bg-gradient-to-br from-orange-500/5 to-orange-600/10 rounded-md p-4 border border-orange-500/20 hover:border-orange-500/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base font-medium flex items-center truncate" title={colName}>
                    <PieChart className="h-4 w-4 mr-2 text-orange-500" />
                    {colName}
                  </h4>
                  <Badge variant="outline" className="border-orange-500/20 text-orange-600 dark:text-orange-400">
                    {stats.uniqueValues} unique
                  </Badge>
                </div>
                
                {/* Distribution bar */}
                {stats.dominance > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center h-6 mb-1">
                      <div className="flex-grow bg-muted rounded-full h-2.5">
                        <div 
                          className="bg-orange-500 h-2.5 rounded-full" 
                          style={{ width: `${stats.dominance}%` }}
                        ></div>
                      </div>
                      <div className="text-xs ml-2 text-muted-foreground">
                        {stats.dominance}% dominant
                      </div>
                    </div>
                  </div>
                )}
                
                {stats.topValues.length > 0 ? (
                  <div className="space-y-2">
                    {stats.topValues.slice(0, 3).map((tv: any, idx: number) => (
                      <div key={idx} className="flex items-center text-sm">
                        <div className="w-20 truncate mr-2" title={tv.value}>
                          {tv.value}
                        </div>
                        <div className="flex-grow bg-muted rounded-full h-2 mr-2">
                          <div 
                            className="bg-orange-500/80 h-2 rounded-full" 
                            style={{ width: `${tv.percentage}%` }}
                          ></div>
                        </div>
                        <div className="text-sm w-12 text-right text-muted-foreground font-medium">
                          {tv.percentage}%
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-2">No frequent values</div>
                )}
                
                {/* Additional stats */}
                <div className="mt-3 grid grid-cols-2 gap-x-4 text-sm">
                  {stats.nullCount > 0 && (
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Null:</span>
                      <span className="font-medium">
                        {((stats.nullCount / reportStats.totalRecords) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {stats.emptyCount > 0 && (
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Empty:</span>
                      <span className="font-medium">
                        {((stats.emptyCount / reportStats.totalRecords) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Diversity:</span>
                    <span className="font-medium">{stats.diversity}%</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Date Columns */}
            {Object.entries(reportStats.dateColumns).map(([colName, stats]: [string, any]) => (
              <div key={colName} className="bg-gradient-to-br from-blue-500/5 to-blue-600/10 rounded-md p-4 border border-blue-500/20 hover:border-blue-500/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base font-medium flex items-center truncate" title={colName}>
                    <CalendarIcon className="h-4 w-4 mr-2 text-blue-500" />
                    {colName}
                  </h4>
                  <Badge variant="outline" className="border-blue-500/20 text-blue-500">
                    {stats.dateRange} days
                  </Badge>
                </div>
                
                {/* Period distribution */}
                {stats.trend !== "stable" && (
                  <div className="mb-3 flex items-center">
                    <Badge className={`mr-2 ${
                      stats.trend === "increasing" 
                        ? "bg-green-500 hover:bg-green-600" 
                        : "bg-red-500 hover:bg-red-600"
                    }`}>
                      {stats.trend} trend
                    </Badge>
                    {stats.weeklyPattern && (
                      <Badge variant="outline" className="mr-2 border-blue-500/20 text-blue-500">
                        weekly pattern
                      </Badge>
                    )}
                    {stats.yearlyPattern && (
                      <Badge variant="outline" className="border-blue-500/20 text-blue-500">
                        seasonal
                      </Badge>
                    )}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">First:</span>
                    <span className="font-medium truncate" title={stats.minDate}>{stats.minDate}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Last:</span>
                    <span className="font-medium truncate" title={stats.maxDate}>{stats.maxDate}</span>
                  </div>
                </div>
                
                {/* Top distribution - show either months or days depending on which has more variation */}
                {stats.monthDistribution && stats.monthDistribution.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-1">
                      {stats.monthDistribution.length > 1 ? "Monthly distribution:" : "Month:"}
                    </div>
                    <div className="flex text-xs">
                      {stats.monthDistribution.slice(0, 6).map(([month, count]: [string, number], idx: number) => {
                        const maxCount = Math.max(
                          ...stats.monthDistribution.map(([_, c]: [string, number]) => c)
                        );
                        const percentage = Math.max(20, (count / maxCount) * 100);
                        return (
                          <div 
                            key={idx} 
                            className="flex-1 flex flex-col items-center"
                            title={`${month}: ${count} records`}
                          >
                            <div 
                              className="w-full bg-blue-500/30 rounded-sm"
                              style={{ height: `${percentage}%`, maxHeight: '24px' }}
                            />
                            <div className="mt-1 truncate w-full text-center" style={{ fontSize: '0.65rem' }}>
                              {month.substring(0, 3)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Render pagination controls
  const renderPagination = () => {
    const { page, pageSize, total, totalPages } = pagination;
    const startRecord = ((page - 1) * pageSize) + 1;
    const endRecord = Math.min(page * pageSize, total);
    
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-4 pb-4 bg-muted/5 rounded-lg border border-green-500/10 py-3">
        <div className="text-sm font-medium flex items-center">
          <span className="text-muted-foreground mr-2">Showing</span> 
          <span className="px-2 py-1 rounded bg-green-500/10 text-green-700 dark:text-green-300">{startRecord}-{endRecord}</span> 
          <span className="text-muted-foreground mx-2">of</span> 
          <span className="px-2 py-1 rounded bg-green-500/10 text-green-700 dark:text-green-300">{total}</span> 
          <span className="text-muted-foreground ml-2">records</span>
        </div>
        <div className="flex items-center gap-3">
          <Select 
            value={pageSize.toString()} 
            onValueChange={(value) => handlePageSizeChange(parseInt(value))}
          >
            <SelectTrigger className="w-[120px] h-8 border-green-500/20 focus-visible:ring-green-500/30">
              <SelectValue placeholder="Rows per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="20">20 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-1 bg-green-500/5 p-1 rounded-md border border-green-500/20">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 hover:bg-green-500/10 hover:text-green-700" 
              onClick={() => handlePageChange(1)}
              disabled={page === 1}
            >
              <span className="sr-only">First Page</span>
              <ChevronFirst className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 hover:bg-green-500/10 hover:text-green-700" 
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
            >
              <span className="sr-only">Previous Page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="text-sm px-2 font-medium flex items-center">
              <span className="text-muted-foreground mr-1">Page</span>
              <span className="inline-block mr-1">
                <Select
                  value={String(page)}
                  onValueChange={(value) => handlePageChange(parseInt(value))}
                >
                <SelectTrigger className="h-7 min-w-8 border-none px-2 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-300 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 mx-1.5 hover:bg-green-500/20 transition-colors">
                  <SelectValue placeholder={page} />
                  {/* <ChevronDown className="h-3.5 w-3.5 ml-0.5 opacity-70" /> */}
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {totalPages <= 100 ? (
                    // For reasonable number of pages, show all
                    Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <SelectItem key={pageNum} value={String(pageNum)}>
                        {pageNum}
                      </SelectItem>
                    ))
                  ) : (
                    // For large number of pages, show groups
                    <>
                      {/* First few pages */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((pageNum) => (
                        <SelectItem 
                          key={pageNum} 
                          value={String(pageNum)}
                          className={pageNum === page ? "bg-green-500/10 text-green-700 dark:text-green-300 font-medium" : ""}
                        >
                          {pageNum}
                        </SelectItem>
                      ))}
                      
                      {/* Separator */}
                      <SelectItem disabled value="separator-1" className="h-0 py-0 my-1 border-b border-muted/50">
                        <span className="sr-only">Separator</span>
                      </SelectItem>
                      
                      {/* Add sections in the middle */}
                      {[10, 20, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500].filter(
                        num => num > 5 && num < totalPages - 5
                      ).map((pageNum) => (
                        <SelectItem 
                          key={pageNum} 
                          value={String(pageNum)}
                          className={pageNum === page ? "bg-green-500/10 text-green-700 dark:text-green-300 font-medium" : ""}
                        >
                          {pageNum}
                        </SelectItem>
                      ))}
                      
                      {/* Separator before current page section */}
                      {page > 5 && page < totalPages - 5 && (
                        <SelectItem disabled value="separator-2" className="h-0 py-0 my-1 border-b border-muted/50">
                          <span className="sr-only">Separator</span>
                        </SelectItem>
                      )}
                      
                      {/* Add pages around current page */}
                      {page > 5 && page < totalPages - 5 && 
                        Array.from(
                          { length: 5 }, 
                          (_, i) => Math.max(6, page - 2) + i
                        )
                        .filter(num => num > 5 && num < totalPages - 5)
                        .map((pageNum) => (
                          <SelectItem 
                            key={`current-${pageNum}`} 
                            value={String(pageNum)}
                            className={pageNum === page ? "bg-green-500/10 text-green-700 dark:text-green-300 font-medium" : ""}
                          >
                            {pageNum}
                          </SelectItem>
                        ))
                      }
                      
                      {/* Separator before last pages */}
                      {totalPages > 10 && (
                        <SelectItem disabled value="separator-3" className="h-0 py-0 my-1 border-b border-muted/50">
                          <span className="sr-only">Separator</span>
                        </SelectItem>
                      )}
                      
                      {/* Last few pages */}
                      {Array.from(
                        { length: 5 }, 
                        (_, i) => totalPages - 4 + i
                      )
                      .filter(num => num > 5)
                      .map((pageNum) => (
                        <SelectItem 
                          key={`last-${pageNum}`} 
                          value={String(pageNum)}
                          className={pageNum === page ? "bg-green-500/10 text-green-700 dark:text-green-300 font-medium" : ""}
                        >
                          {pageNum}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              </span>
              <span className="text-muted-foreground mr-1">of</span>
              <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-300 text-center">{totalPages}</span>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 hover:bg-green-500/10 hover:text-green-700" 
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <span className="sr-only">Next Page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 hover:bg-green-500/10 hover:text-green-700" 
              onClick={() => handlePageChange(totalPages)}
              disabled={page >= totalPages}
            >
              <span className="sr-only">Last Page</span>
              <ChevronLast className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Toggle between Data Insights and Table
  const toggleView = (showInsights: boolean) => {
    setShowReportOverview(showInsights);
    setShowDataTable(!showInsights);
  };

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between py-2 mb-4 border-b border-primary/10">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" className="px-2 h-8 hover:bg-primary/5" onClick={() => router.back()}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                <span className="text-sm">Back</span>
              </Button>
              <h1 className="text-2xl font-bold flex items-center">
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center mr-2.5">
                  <Database className="h-4.5 w-4.5 text-primary" />
                </div>
                {tableName}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-sm border-primary/20 hover:border-primary/40 hover:bg-primary/5" onClick={() => setShowSqlEditor(!showSqlEditor)}>
                    <Code className="h-3.5 w-3.5 mr-1.5 text-primary" />
                    {showSqlEditor ? "Hide" : "Show"} SQL Editor
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle SQL editor view</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" className="h-8 text-sm bg-primary/90 hover:bg-primary text-white dark:text-white" onClick={executeQuery} disabled={executing}>
                    {executing ? <Zap className="h-3.5 w-3.5 mr-1.5 animate-pulse" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                    {executing ? "Running..." : "Run Query"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Execute current filters and SQL</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" className="h-8 text-sm bg-primary hover:bg-primary/90 text-white dark:text-white" onClick={() => setShowSaveDialog(true)}>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Save Segment
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save current configuration as a segment</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex flex-1 gap-6 h-[calc(100vh-12rem)] overflow-hidden">
            {/* Left Sidebar - Filters - 35% width */}
            <div className="w-[30%] flex-shrink-0 flex flex-col h-full border-r border-primary/10 pr-4 overflow-hidden">
              {/* Filter Groups Header */}
              <Card className={cn("border mb-4 sticky top-0 z-10", gradientCardStyles({ variant: "primary" }))}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2 text-base">
                      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span>Filter Groups</span>
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" className="h-7 w-7 p-0 rounded-full bg-primary hover:bg-primary/90" onClick={addFilterGroup}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add new filter group</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  {totalFilterCount > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {totalFilterCount} total filter{totalFilterCount !== 1 ? "s" : ""} across {filterGroups.length}{" "}
                      group{filterGroups.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </CardHeader>
              </Card>

              {/* Filter Groups - Scrollable */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[calc(100vh-25rem)] custom-scrollbar pb-4">
                {filterGroups.length === 0 ? (
                  <Card className="border-dashed border-primary/20 bg-primary/5">
                    <CardContent className="text-center py-12">
                      <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                        <FilterIcon className="h-8 w-8 text-primary opacity-70" />
                      </div>
                      <h3 className="font-medium mb-2">No filter groups yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create your first filter group to start building your segment
                      </p>
                      <Button onClick={addFilterGroup} className="bg-primary/90 hover:bg-primary text-white dark:text-white">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Filter Group
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  filterGroups.map((group, index) => (
                    <div key={group.id}>
                      <FilterGroupBuilder
                        group={group}
                        columns={columns}
                        onUpdate={(updates) => updateFilterGroup(group.id, updates)}
                        onRemove={() => removeFilterGroup(group.id)}
                        onDuplicate={() => duplicateFilterGroup(group.id)}
                        rowCount={filterGroupRowCounts[group.id]}
                      />
                      {index < filterGroups.length - 1 && (
                        <div className="flex items-center justify-center py-3">
                          <Select
                            value={betweenGroupConditions[index] || "AND"}
                            onValueChange={(value) => updateBetweenGroupCondition(index, value)}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AND">AND</SelectItem>
                              <SelectItem value="OR">OR</SelectItem>
                              <SelectItem value="NOT">NOT</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Timing Configuration - Sticky Bottom */}
              <Card className="border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-blue-600/10 mt-4 sticky bottom-0">
                <CardHeader className="py-3">
                  <CardTitle className="flex items-center text-base">
                    <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center mr-2">
                      <CalendarIcon className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    Execution Timing
                  </CardTitle>
                  <CardDescription className="text-xs text-blue-500/70">
                    Configure when this segment should be executed
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate" className="text-xs mb-1 block text-blue-600/80 dark:text-blue-400/80 font-medium">
                        Start Date
                      </Label>
                      <DatePicker 
                        date={segmentData.startDate} 
                        setDate={(date) => setSegmentData({ ...segmentData, startDate: date })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate" className="text-xs mb-1 block text-blue-600/80 dark:text-blue-400/80 font-medium">
                        End Date
                      </Label>
                      <DatePicker 
                        date={segmentData.endDate} 
                        setDate={(date) => setSegmentData({ ...segmentData, endDate: date })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime" className="text-xs mb-1 block text-blue-600/80 dark:text-blue-400/80 font-medium">
                        Start Time
                      </Label>
                      <TimePicker
                        time={segmentData.startTime}
                        setTime={(time) => setSegmentData({ ...segmentData, startTime: time })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime" className="text-xs mb-1 block text-blue-600/80 dark:text-blue-400/80 font-medium">
                        End Time
                      </Label>
                      <TimePicker
                        time={segmentData.endTime}
                        setTime={(time) => setSegmentData({ ...segmentData, endTime: time })}
                      />
                    </div>
                  </div>
                  
                  {(segmentData.startDate || segmentData.endDate || 
                    segmentData.startTime !== "00:00" || segmentData.endTime !== "23:59") && (
                    <div className="mt-3 p-2 rounded-md bg-blue-500/10 border border-blue-500/20 text-xs">
                      <div className="flex items-center text-blue-600 dark:text-blue-400">
                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                        <span className="font-medium">Execution schedule:</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {segmentData.startDate && segmentData.endDate ? 
                          `From ${new Date(segmentData.startDate).toLocaleDateString()} to ${new Date(segmentData.endDate).toLocaleDateString()}` :
                          segmentData.startDate ? 
                            `Starting from ${new Date(segmentData.startDate).toLocaleDateString()}` :
                            segmentData.endDate ? 
                              `Until ${new Date(segmentData.endDate).toLocaleDateString()}` : 
                              "No date constraints"
                        }
                        {(segmentData.startTime !== "00:00" || segmentData.endTime !== "23:59") && 
                          `, daily between ${segmentData.startTime} and ${segmentData.endTime}`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Side - Data View - 65% width */}
            <div className="w-[70%] overflow-y-auto space-y-4">
              {showSqlEditor && (
                <SqlEditor
                  sql={customSql || generateSqlFromFilters()}
                  onChange={setCustomSql}
                  onExecute={executeQuery}
                  onReset={resetSqlEditor}
                />
              )}

              {/* Report Overview - Separate Card */}
              {tableData && tableData.length > 0 && (
                <Card className="border overflow-y-auto max-h-[calc(100vh-17rem)] custom-scrollbar border-secondary/20 bg-gradient-to-br from-secondary/5 to-secondary/10">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-secondary/20">
                    <h3 className="text-base flex items-center font-medium">
                      <div className="h-6 w-6 rounded-md bg-secondary/10 flex items-center justify-center mr-2">
                        <BarChart className="h-4 w-4 text-secondary" />
                      </div>
                      Data Insights
                    </h3>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 px-4 text-sm border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                      onClick={() => toggleView(!showReportOverview)}
                    >
                      {showReportOverview ? "Show Table" : "Show Insights"}
                    </Button>
                  </div>
                  {showReportOverview && (
                    <div className="p-5">
                      {renderReportOverview()}
                    </div>
                  )}
                </Card>
              )}

              {/* Data Preview */}
              <Card className="border border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-600/10">
                <CardHeader>
                  <div className="flex items-center justify-between flex-col sm:flex-row gap-2">
                    <CardTitle className="flex items-center">
                      <div className="h-6 w-6 rounded-md bg-green-500/10 flex items-center justify-center mr-2">
                        <Eye className="h-3.5 w-3.5 text-green-500" />
                      </div>
                      Data Preview
                    </CardTitle>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <div className="flex flex-col items-center px-4 py-2 bg-green-500/10 rounded-md border border-green-500/20">
                          <span className="text-lg font-semibold text-green-700 dark:text-green-300">{pagination.total}</span>
                          <span className="text-xs text-muted-foreground">Overall Rows</span>
                        </div>
                        <div className="flex flex-col items-center px-4 py-2 bg-green-500/10 rounded-md border border-green-500/20">
                          <span className="text-lg font-semibold text-green-700 dark:text-green-300">{pagination.page || 0}</span>
                          <span className="text-xs text-muted-foreground">current page</span>
                        </div>
                        {/* <div className="flex flex-col items-center px-4 py-2 bg-green-500/10 rounded-md border border-green-500/20">
                          <span className="text-lg font-semibold text-green-700 dark:text-green-300">{columns?.length || 0}</span>
                          <span className="text-xs text-muted-foreground">columns</span>
                        </div> */}
                        {enabledFilterCount > 0 && (
                          <div className="flex flex-col items-center px-4 py-2 bg-primary/10 rounded-md border border-primary/20">
                            <span className="text-lg font-semibold text-primary">{enabledFilterCount}</span>
                            <span className="text-xs text-muted-foreground">
                              filter group{enabledFilterCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        )}
                      </div>
                      {tableData && tableData.length > 0 && columns && columns.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const timestamp = new Date().toISOString().replace(/:/g, '-').substring(0, 19);
                              const filename = `${tableName}-export-${timestamp}.csv`;
                              const columnNames = columns.map(col => col.name);
                              dataService.exportTableDataToCSV(tableData, columnNames, filename);
                            }}
                            className="flex items-center gap-1 border-green-500/20 hover:border-green-500/40 hover:bg-green-500/5"
                          >
                            <Download className="h-4 w-4 text-green-500" />
                            Export Page
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => toggleView(!showReportOverview)}
                            className="flex items-center gap-1 bg-primary/90 hover:bg-primary text-white dark:text-white"
                          >
                            <BarChart className="h-4 w-4" />
                            {showReportOverview ? "Show Table" : "Show Insights"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 sm:p-0">
                  {showDataTable && (
                    <div className="space-y-4">
                      <div className="rounded-md border border-green-500/20 overflow-hidden">
                        <DataTable data={tableData || []} columns={columns || []} />
                      </div>
                      {renderPagination()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Save Segment Dialog */}
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogContent className="bg-gradient-to-br from-background to-muted/30 border-primary/20">
              <DialogHeader>
                <DialogTitle className="flex items-center">
                  <div className="h-7 w-7 rounded-md bg-secondary/10 flex items-center justify-center mr-2">
                    <Save className="h-4 w-4 text-secondary" />
                  </div>
                  Save Segment
                </DialogTitle>
                <DialogDescription>
                  Give your segment a name and description to save it for future use.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="segmentName">Segment Name</Label>
                  <Input
                    id="segmentName"
                    value={segmentData.name}
                    onChange={(e) => setSegmentData({ ...segmentData, name: e.target.value })}
                    placeholder="Enter segment name"
                    className="border-primary/20 focus-visible:ring-primary/30"
                  />
                </div>
                <div>
                  <Label htmlFor="segmentDescription">Description</Label>
                  <Textarea
                    id="segmentDescription"
                    value={segmentData.description}
                    onChange={(e) => setSegmentData({ ...segmentData, description: e.target.value })}
                    placeholder="Describe what this segment represents"
                    rows={3}
                    className="border-primary/20 focus-visible:ring-primary/30"
                  />
                </div>
                <Separator className="bg-primary/10" />
                <div className="text-sm space-y-2 p-3 rounded-md bg-primary/5 border border-primary/10">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Table:</span>
                    <span className="font-medium">{tableName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Filter Groups:</span>
                    <span className="font-medium">
                      {enabledFilterCount} active, {filterGroups.length} total
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Filters:</span>
                    <span className="font-medium">{totalFilterCount}</span>
                  </div>
                  {(segmentData.startDate || segmentData.endDate) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Execution Period:</span>
                      <span className="font-medium">
                        {segmentData.startDate || "No start"} to {segmentData.endDate || "No end"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSaveDialog(false)} className="border-muted-foreground/20">
                  Cancel
                </Button>
                <Button onClick={saveSegment} disabled={saving} className="bg-primary hover:bg-primary/90 text-white dark:text-white">
                  {saving ? "Saving..." : "Save Segment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  )
}