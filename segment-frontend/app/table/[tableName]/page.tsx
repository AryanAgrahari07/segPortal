"use client"

import { useState, useEffect } from "react"
import { cva } from "class-variance-authority"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Database, Play, Save, Plus, FilterIcon, Code, Calendar as CalendarIcon, ArrowLeft, Layers, Zap, Eye, Download, BarChart, PieChart, ChevronFirst, ChevronLeft, ChevronRight, ChevronLast, Clock, ChevronDown, GripVertical, Loader2 } from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { FilterGroupBuilder } from "@/components/segment/filter-group-builder"
import { DataTable } from "@/components/segment/data-table"
import { SqlEditor } from "@/components/segment/sql-editor"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"

// Add calendar and popover imports
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Add custom animation keyframes
import { keyframes } from "tailwindcss/defaultTheme"

// Custom progress animation keyframe
const progressAnimation = {
  '@keyframes progress': {
    '0%': { transform: 'translateX(-100%)' },
    '50%': { transform: 'translateX(0%)' },
    '100%': { transform: 'translateX(100%)' }
  },
  '.animate-progress': {
    animation: 'progress 1.5s ease-in-out infinite'
  }
}

// Inject the animation into the stylesheet
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes progress {
      0% { transform: translateX(-100%); }
      50% { transform: translateX(0%); }
      100% { transform: translateX(100%); }
    }
  `
  document.head.appendChild(style)
}

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
  status?: string // Add this line
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


// Define gradient card styles for consistent UI
const gradientCardStyles = cva(
  "bg-gradient-to-br transition-all duration-300 hover:shadow-md",
  {
    variants: {
      variant: {
        primary: "from-violet-500/5 to-indigo-500/10 border-violet-500/20 hover:border-violet-500/30",
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


// Add a DatePicker component function at the appropriate place, before the TableDetailPage component
function DatePicker({ 
  date, 
  setDate, 
  className,
  isRequired = false
}: { 
  date: string, 
  setDate: (date: string) => void,
  className?: string,
  isRequired?: boolean
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
      // Format date as YYYY-MM-DD using local timezone to avoid date shifts
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
      const day = String(newDate.getDate()).padStart(2, '0');
      
      const formattedDate = `${year}-${month}-${day}`;
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
            "w-full justify-start text-left font-normal h-9 border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30",
            !date && "text-muted-foreground",
            !date && isRequired && "border-red-300 dark:border-red-700",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-violet-600" />
          {date ? formatDate(selectedDate!) : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b border-violet-200 dark:border-violet-800 flex justify-between items-center">
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">Go to year</span>
          <Select value={(month?.getFullYear() || currentYear).toString()} onValueChange={handleYearChange}>
            <SelectTrigger className="h-8 w-[5rem] px-2 text-xs border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30">
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
            caption_label: "text-sm font-medium text-violet-700 dark:text-violet-300",
            cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
            day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-violet-100 dark:hover:bg-violet-900/20",
            day_selected: "bg-violet-600 text-white hover:bg-violet-500 hover:text-white focus:bg-violet-600 focus:text-white",
            day_today: "bg-violet-100 text-violet-700 dark:bg-violet-800/30 dark:text-violet-300",
            head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-violet-600"
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
    <div className={cn("flex items-center", className)}>
      <div className="w-full flex items-center h-9 px-2 py-2 rounded-md border border-violet-300 dark:border-violet-700 bg-transparent text-sm ring-offset-background focus-within:ring-2 focus-within:ring-violet-500/30 focus-within:ring-offset-2">
        <Clock className="mr-1.5 h-4 w-4 text-violet-600 flex-shrink-0" />
        <div className="flex items-center w-full justify-between">
          <Select value={hours.toString().padStart(2, '0')} onValueChange={handleHourChange}>
            <SelectTrigger className="w-[3.5rem] h-7 px-1 text-center border-0 focus:ring-0 shadow-none">
              <SelectValue placeholder="HH" />
            </SelectTrigger>
            <SelectContent>
              <div className="max-h-[200px] overflow-y-auto">
                {hourOptions.map((hour) => (
                  <SelectItem key={hour} value={hour}>
                    {hour}
                  </SelectItem>
                ))}
              </div>
            </SelectContent>
          </Select>
          <span className="mx-1 text-violet-500">:</span>
          <Select value={minutes.toString().padStart(2, '0')} onValueChange={handleMinuteChange}>
            <SelectTrigger className="w-[3.5rem] h-7 px-1 text-center border-0 focus:ring-0 shadow-none">
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent>
              <div className="max-h-[200px] overflow-y-auto">
                {minuteOptions.map((minute) => (
                  <SelectItem key={minute} value={minute}>
                    {minute}
                  </SelectItem>
                ))}
              </div>
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
    status: "active" // Default to active for new segments
  })
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSqlEditor, setShowSqlEditor] = useState(false)
  const [generatedSql, setGeneratedSql] = useState("")
  const [customSql, setCustomSql] = useState("")
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showReportOverview, setShowReportOverview] = useState(false)
  const [showDataTable, setShowDataTable] = useState(true)
  const [filterGroupRowCounts, setFilterGroupRowCounts] = useState<Record<string, number>>({})
  const [tableLoading, setTableLoading] = useState(false)
  const [uniqueEmails, setUniqueEmails] = useState<number | null>(null)
  const [hasEmailColumn, setHasEmailColumn] = useState<boolean>(false)
  
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
    // Only execute query when pagination changes, but don't reset page number here
    // This effect is for pagination navigation only
    if (!loading) { // Prevent initial double-loading
      const fetchPageData = async () => {
        setTableLoading(true);
        try {
          if (customSql) {
            // Execute query with custom SQL for the new page
            const customResponse = await dataService.getTableData(tableName, { 
              customSql,
              filterGroups: [],
              page: pagination.page,
              pageSize: pagination.pageSize
            });
            
            // Process response
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
                if (customResponse.data.pagination) {
                  paginationData = customResponse.data.pagination;
                }
                // Get unique email count if available
                if (customResponse.data.uniqueEmails !== undefined) {
                  setUniqueEmails(customResponse.data.uniqueEmails);
                  // If we got a uniqueEmails response (even if 0), we know there's an email column
                  setHasEmailColumn(true);
                } else {
                  // If uniqueEmails is not in the response, there's likely no email column
                  setHasEmailColumn(false);
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
              total: paginationData.total,
              totalPages: paginationData.totalPages
            }));
          } else {
            // Format filters for the new page
            const filterQueryData = {
              filterGroups: filterGroups
                .filter((group) => group.isEnabled !== false)
                .map((group) => ({
                  logic_operator: group.condition === "NOT" ? "AND" : group.condition,
                  not: group.condition === "NOT",
                  filters: group.filters.map((filter) => {
                    // Check if this is a date preset operator
                    const isDatePresetOperator = [
                      "LAST_1_DAY",
                      "LAST_7_DAYS", 
                      "LAST_30_DAYS", 
                      "THIS_MONTH", 
                      "LAST_MONTH",
                      "LAST_3_MONTHS", 
                      "LAST_6_MONTHS", 
                      "THIS_YEAR", 
                      "LAST_YEAR",
                      "LAST_12_MONTHS"
                    ].includes(filter.operator);
                    
                    // For date preset operators, we use the value and value2 directly
                    // as they were already calculated in the filter-builder component
                    if (isDatePresetOperator) {
                      return {
                        type: 'condition',
                        column: filter.column,
                        operator: 'between', // Use between operator for all date presets
                        value: [filter.value, filter.value2],
                        date_preset: mapOperatorToBackend(filter.operator) // Add the date_preset property
                      };
                    }
                    
                    // For regular operators
                    return {
                      type: 'condition',
                      column: filter.column,
                      operator: mapOperatorToBackend(filter.operator),
                      value: filter.operator === 'BETWEEN' || filter.operator === 'NOT_BETWEEN' 
                        ? [filter.value, filter.value2] 
                        : filter.operator === 'IN' || filter.operator === 'NOT_IN' 
                          ? filter.value.split(',').map((v: string) => v.trim()) 
                          : filter.value
                    };
                  })
                })),
              groupConditions: betweenGroupConditions.length > 0 ? betweenGroupConditions : ['AND'],
              page: pagination.page,
              pageSize: pagination.pageSize
            };
            
            // Execute query for the new page
            const filterResponse = await dataService.getTableData(tableName, filterQueryData);
            
            // Process response
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
                if (filterResponse.data.pagination) {
                  paginationData = filterResponse.data.pagination;
                }
                // Get unique email count if available
                if (filterResponse.data.uniqueEmails !== undefined) {
                  setUniqueEmails(filterResponse.data.uniqueEmails);
                  // If we got a uniqueEmails response (even if 0), we know there's an email column
                  setHasEmailColumn(true);
                } else {
                  // If uniqueEmails is not in the response, there's likely no email column
                  setHasEmailColumn(false);
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
          }
        } catch (error: any) {
          console.error("Error fetching page data:", error);
          toast({
            title: "Error",
            description: error.message || "Failed to fetch page data",
            variant: "destructive",
          });
        } finally {
          setTableLoading(false);
        }
      };
      
      fetchPageData();
    }
  }, [pagination.page, pagination.pageSize])

  const loadTableData = async () => {
    try {
      setLoading(true);
      setTableLoading(true);

      // Load table metadata
      try {
        const response = await dataService.getTableMetadata(tableName, segmentId) as any;
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
                normalizedType = "DATE";
                break;
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
          
          // Check if there's an email column
          const emailColumnPattern = /email|e_mail|mail|email_address/i;
          const hasEmail = formattedColumns.some(col => emailColumnPattern.test(col.name));
          setHasEmailColumn(hasEmail);
          
          // console.log("Formatted columns:", formattedColumns);
          setColumns(formattedColumns);
        } else {
          console.error("No columns found in metadata:", response);
          setColumns([]);
          setHasEmailColumn(false);
        }
      } catch (metadataError) {
        console.error("Error loading table metadata:", metadataError);
        setColumns([]);
        setHasEmailColumn(false);
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
              // The group_condition field in the database represents the condition between filters within the group
              // If NOT flag is set, we need to use "NOT" as the condition, otherwise use the group_condition
              condition: group.not ? "NOT" : (group.group_condition || "AND"),
              isCollapsed: false,
              isEnabled: true,
              filters:
                group.filters?.map((filter: any) => ({
                  id: filter.id || `filter-${Date.now()}-${Math.random()}`,
                  column: filter.column_name || "",
                  operator: mapOperatorFromBackend(filter.filter_operator) || "=",
                  value: Array.isArray(filter.filter_value) && filter.filter_value.length > 0 
                    ? filter.filter_value[0] 
                    : filter.filter_value || "",
                  value2: Array.isArray(filter.filter_value) && filter.filter_value.length > 1
                    ? filter.filter_value[1]
                    : filter.filter_value_2 || "",
                })) || [],
            }));

            setFilterGroups(convertedGroups as FilterGroup[]);
            
            // Set between-group conditions if available
            if (segment.groupConditions && Array.isArray(segment.groupConditions)) {
              setBetweenGroupConditions(segment.groupConditions);
            } else if (segment.filter_groups.length > 1) {
              // If groupConditions is not available, try to extract from between_group_condition
              const extractedConditions = segment.filter_groups.slice(1).map(group => 
                group.between_group_condition || "AND"
              );
              setBetweenGroupConditions(extractedConditions);
            }
            
            // Set segment data
            setSegmentData({
              name: segment.segment_name || "",
              description: segment.description || "",
              startDate: segment.segment_config?.start_date || "",
              endDate: segment.segment_config?.end_date || "",
              startTime: segment.segment_config?.start_time || "00:00",
              endTime: segment.segment_config?.end_time || "23:59",
              status: segment.status || "active" // Add this line to preserve the segment status
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
                  logic_operator: group.condition === "NOT" ? "AND" : group.condition,
                  not: group.condition === "NOT", // Set NOT flag for NOT condition
                  filters: group.filters.map((filter: any) => {
                    // Check if this is a date preset operator
                    const isDatePresetOperator = [
                      "LAST_1_DAY",
                      "LAST_7_DAYS", 
                      "LAST_30_DAYS", 
                      "THIS_MONTH", 
                      "LAST_MONTH",
                      "LAST_3_MONTHS", 
                      "LAST_6_MONTHS", 
                      "THIS_YEAR", 
                      "LAST_YEAR",
                      "LAST_12_MONTHS"
                    ].includes(filter.operator);
                    
                    // For date preset operators, use between operator and pass both values as an array
                    if (isDatePresetOperator) {
                      // Check if we have valid date values
                      const hasValidDates = filter.value && filter.value2;
                      
                      return {
                        type: 'condition',
                        column: filter.column,
                        operator: 'between', // Use between operator for date presets
                        value: hasValidDates ? [filter.value, filter.value2] : [], // Pass values if available, otherwise empty array
                        date_preset: filter.date_preset || mapOperatorToBackend(filter.operator) // Use existing date_preset if available, otherwise map from operator
                      };
                    }
                    
                    // For regular operators
                    return {
                      type: 'condition',
                      column: filter.column,
                      operator: mapOperatorToBackend(filter.operator),
                      value: filter.operator === 'BETWEEN' || filter.operator === 'NOT_BETWEEN' ? 
                             [filter.value, filter.value2] : 
                             filter.operator === 'IN' || filter.operator === 'NOT_IN' ? 
                             filter.value.split(',').map((v: string) => v.trim()) :
                             filter.value
                    };
                  })
                })),
                // Include between-group conditions if available
                groupConditions: segment.groupConditions && Array.isArray(segment.groupConditions) ? 
                  segment.groupConditions : ['AND'],
                page: pagination.page,
                pageSize: pagination.pageSize,
                segmentId: segmentId || undefined // Pass segmentId to the backend
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
                  
                  // Get unique email count if available
                  if (tableDataResponse.data.uniqueEmails !== undefined) {
                    setUniqueEmails(tableDataResponse.data.uniqueEmails);
                    setHasEmailColumn(true);
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
                    
                    // Get unique email count if available
                    if (data.data.uniqueEmails !== undefined) {
                      setUniqueEmails(data.data.uniqueEmails);
                      setHasEmailColumn(true);
                    }
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
                  
                  // Get unique email count if available
                  if (data.data.uniqueEmails !== undefined) {
                    setUniqueEmails(data.data.uniqueEmails);
                    setHasEmailColumn(true);
                  }
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
                
                // Get unique email count if available
                if (data.data.uniqueEmails !== undefined) {
                  setUniqueEmails(data.data.uniqueEmails);
                  setHasEmailColumn(true);
                }
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
              
              // Get unique email count if available
              if (response.data.uniqueEmails !== undefined) {
                setUniqueEmails(response.data.uniqueEmails);
                setHasEmailColumn(true);
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
      setTableLoading(false);
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
            
            // Special handling for date preset operators
            const isDatePresetOperator = [
              "LAST_1_DAY",
              "LAST_7_DAYS", 
              "LAST_30_DAYS", 
              "THIS_MONTH", 
              "LAST_MONTH",
              "LAST_3_MONTHS", 
              "LAST_6_MONTHS", 
              "THIS_YEAR", 
              "LAST_YEAR",
              "LAST_12_MONTHS"
            ].includes(filter.operator);
            
            if (isDatePresetOperator) {
              // For date preset operators, use dynamic SQL with INTERVAL syntax
              switch (filter.operator) {
                case "LAST_1_DAY":
                  clause = `${filter.column} BETWEEN CURRENT_DATE - INTERVAL '1 day' AND CURRENT_DATE`
                  break
                case "LAST_7_DAYS":
                  clause = `${filter.column} BETWEEN CURRENT_DATE - INTERVAL '6 days' AND CURRENT_DATE`
                  break
                case "LAST_30_DAYS":
                  clause = `${filter.column} BETWEEN CURRENT_DATE - INTERVAL '29 days' AND CURRENT_DATE`
                  break
                case "THIS_MONTH":
                  clause = `${filter.column} BETWEEN DATE_TRUNC('month', CURRENT_DATE) AND LAST_DAY(CURRENT_DATE)`
                  break
                case "LAST_MONTH":
                  clause = `${filter.column} BETWEEN DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND LAST_DAY(CURRENT_DATE - INTERVAL '1 month')`
                  break
                case "LAST_3_MONTHS":
                  clause = `${filter.column} BETWEEN CURRENT_DATE - INTERVAL '89 days' AND CURRENT_DATE`
                  break
                case "LAST_6_MONTHS":
                  clause = `${filter.column} BETWEEN CURRENT_DATE - INTERVAL '6 months' AND CURRENT_DATE`
                  break
                case "THIS_YEAR":
                  clause = `${filter.column} BETWEEN DATE_TRUNC('year', CURRENT_DATE) AND DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day'`
                  break
                case "LAST_YEAR":
                  clause = `${filter.column} BETWEEN DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year') AND DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 day'`
                  break
                case "LAST_12_MONTHS":
                  clause = `${filter.column} BETWEEN CURRENT_DATE - INTERVAL '12 months' AND CURRENT_DATE`
                  break
                default:
                  // Fall back to using the dynamically calculated dates if available
                  if (filter.value && filter.value2) {
                    clause = `${filter.column} BETWEEN '${filter.value}' AND '${filter.value2}'`
                  }
              }
            } else {
              // Regular operators
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
            }
            
            return clause
          })
          .filter(Boolean)

        if (filterClauses.length === 0) return ""
        
        // For NOT condition groups, we join the filters with AND and then negate the entire group
        // This is the correct logical implementation: NOT(A AND B AND C)
        // For other conditions (AND, OR), we join the filters with the specified condition
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

  // Function to ensure SQL has balanced parentheses and proper syntax
  const ensureValidSqlSyntax = (sql: string): string => {
    if (!sql) return sql;
    
    // Check for balanced parentheses
    let openParens = 0;
    let closeParens = 0;
    
    for (let i = 0; i < sql.length; i++) {
      if (sql[i] === '(') openParens++;
      if (sql[i] === ')') closeParens++;
    }
    
    // Add missing closing parentheses
    let fixedSql = sql;
    if (openParens > closeParens) {
      fixedSql += ')'.repeat(openParens - closeParens);
    }
    
    // Ensure SQL ends with LIMIT clause
    if (!fixedSql.toLowerCase().includes('limit')) {
      fixedSql += ' LIMIT 1000';
    }
    
    // Fix common syntax errors
    // Ensure string values are properly quoted
    fixedSql = fixedSql.replace(/(\w+)\s*=\s*([^'\s][^\s,)]*)/g, (match, col, val) => {
      // Skip if val is a number or already quoted
      if (!isNaN(Number(val)) || val.startsWith("'") || val.startsWith('"')) {
        return match;
      }
      // Skip for special SQL keywords
      if (['null', 'true', 'false', 'current_date', 'current_timestamp'].includes(val.toLowerCase())) {
        return match;
      }
      return `${col} = '${val}'`;
    });
    
    return fixedSql;
  }

  const executeQuery = async () => {
    setExecuting(true);
    setTableLoading(true);
    try {
      // Reset pagination to first page when manually executing query
      setPagination(prev => ({
        ...prev,
        page: 1
      }));

      if (customSql) {
        // Handle custom SQL
        // Validate and fix syntax issues
        const validatedCustomSql = ensureValidSqlSyntax(customSql);
        
        const validation = validateSql(validatedCustomSql, tableName);
        if (!validation.isValid) {
          toast({
            title: "Invalid SQL",
            description: validation.error || "Please check your SQL query",
            variant: "destructive",
          });
          setExecuting(false);
          setTableLoading(false);
          return;
        }
        
        setGeneratedSql(validatedCustomSql);
        
        // Execute query with custom SQL
        // The backend will handle parsing the SQL
        const customResponse = await dataService.getTableData(tableName, { 
          customSql: validatedCustomSql,
          filterGroups: [],
          page: 1, // Always use page 1 when executing a new query
          pageSize: pagination.pageSize,
          segmentId: segmentId || undefined // Pass segmentId when using custom SQL
        });
        
        // Handle response
        let customTableRows: any[] = [];
        let paginationData = {
          page: 1,
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
            
            // Get unique email count if available
            if (customResponse.data.uniqueEmails !== undefined) {
              setUniqueEmails(customResponse.data.uniqueEmails);
              // If we got a uniqueEmails response (even if 0), we know there's an email column
              setHasEmailColumn(true);
            } else {
              // If uniqueEmails is not in the response, there's likely no email column
              setHasEmailColumn(false);
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
          page: 1,
          total: paginationData.total,
          totalPages: paginationData.totalPages
        }));
      } else {
        // Generate SQL from filters
        const generatedFilterSql = generateSqlFromFilters();
        setGeneratedSql(generatedFilterSql);
        
        // Format filters for API
        const filterQueryData = {
          filterGroups: filterGroups
            .filter((group) => group.isEnabled !== false)
            .map((group) => ({
              // For NOT condition, we use AND as the internal logic operator
              // and set the 'not' flag to true to indicate negation of the entire group
              logic_operator: group.condition === "NOT" ? "AND" : group.condition,
              not: group.condition === "NOT",
              filters: group.filters.map((filter) => {
                // Check if this is a date preset operator
                const isDatePresetOperator = [
                  "LAST_1_DAY",
                  "LAST_7_DAYS", 
                  "LAST_30_DAYS", 
                  "THIS_MONTH", 
                  "LAST_MONTH",
                  "LAST_3_MONTHS", 
                  "LAST_6_MONTHS", 
                  "THIS_YEAR", 
                  "LAST_YEAR",
                  "LAST_12_MONTHS"
                ].includes(filter.operator);
                
                // For date preset operators, we use the value and value2 directly
                // as they were already calculated in the filter-builder component
                if (isDatePresetOperator) {
                  return {
                    type: 'condition',
                    column: filter.column,
                    operator: 'between', // Use between operator for all date presets
                    value: [filter.value, filter.value2],
                    date_preset: mapOperatorToBackend(filter.operator) // Add the date_preset property
                  };
                }
                
                // For regular operators
                return {
                  type: 'condition',
                  column: filter.column,
                  operator: mapOperatorToBackend(filter.operator),
                  value: filter.operator === 'BETWEEN' || filter.operator === 'NOT_BETWEEN' 
                    ? [filter.value, filter.value2] 
                    : filter.operator === 'IN' || filter.operator === 'NOT_IN' 
                      ? filter.value.split(',').map((v: string) => v.trim()) 
                      : filter.value
                };
              })
            })),
          groupConditions: betweenGroupConditions.length > 0 ? betweenGroupConditions : ['AND'],
          page: 1, // Always use page 1 when executing a new query
          pageSize: pagination.pageSize,
          segmentId: segmentId || undefined // Pass segmentId when using filters
        };
        
        // Execute query with filters
        const filterResponse = await dataService.getTableData(tableName, filterQueryData);
        
        // Process response
        let filterTableRows: any[] = [];
        let paginationData = {
          page: 1,
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
            
            // Get unique email count if available
            if (filterResponse.data.uniqueEmails !== undefined) {
              setUniqueEmails(filterResponse.data.uniqueEmails);
              // If we got a uniqueEmails response (even if 0), we know there's an email column
              setHasEmailColumn(true);
            } else {
              // If uniqueEmails is not in the response, there's likely no email column
              setHasEmailColumn(false);
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
          page: 1,
          total: paginationData.total,
          totalPages: paginationData.totalPages
        }));
      }
    } catch (error) {
      console.error("Error executing query:", error);
      toast({
        title: "Error",
        description: "Failed to execute query. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
      setTableLoading(false);
    }
  };

  const resetSqlEditor = () => {
    const generatedSql = generateSqlFromFilters();
    setCustomSql(generatedSql);
    setGeneratedSql(generatedSql);
    
    toast({
      title: "SQL Reset",
      description: "SQL reset to filter-generated query with dynamic date expressions",
    });
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
            // Use the actual condition for the group, with special handling for NOT
            logic_operator: group.condition === "NOT" ? "AND" : group.condition,
            not: group.condition === "NOT",
            filters: group.filters.map((filter: any) => {
              // Check if this is a date preset operator
              const isDatePresetOperator = [
                "LAST_1_DAY",
                "LAST_7_DAYS", 
                "LAST_30_DAYS", 
                "THIS_MONTH", 
                "LAST_MONTH",
                "LAST_3_MONTHS", 
                "LAST_6_MONTHS", 
                "THIS_YEAR", 
                "LAST_YEAR",
                "LAST_12_MONTHS"
              ].includes(filter.operator);
              
              // For date preset operators, use between operator and pass both values as an array
              if (isDatePresetOperator) {
                return {
                  type: 'condition',
                  column: filter.column,
                  operator: 'between', // Use between operator for date presets
                  value: [filter.value, filter.value2], // Pass both values as array
                  date_preset: mapOperatorToBackend(filter.operator) // Pass the date preset
                };
              }
              
              // For regular operators
              return {
                type: 'condition',
                column: filter.column,
                operator: mapOperatorToBackend(filter.operator),
                value: filter.operator === 'BETWEEN' || filter.operator === 'NOT_BETWEEN' 
                  ? [filter.value, filter.value2] 
                  : filter.operator === 'IN' || filter.operator === 'NOT_IN' 
                    ? filter.value.split(',').map((v: string) => v.trim()) 
                    : filter.value
              };
            })
          })),
          // Add between-group conditions for the groups we're including
          groupConditions: cumulativeBetweenConditions.length > 0 ? cumulativeBetweenConditions : ['AND'],
          // We only need the count, not the actual data
          page: 1,
          pageSize: 1,
          countOnly: true // Add a flag to indicate we only need the count
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
  
  // Modify the useEffect to ensure we don't make duplicate API calls
  useEffect(() => {
    if (!loading && !executing && filterGroups.length > 0) {
      // Wait a bit to ensure all filter values are properly set
      // especially for date preset operators
      const timer = setTimeout(() => {
        calculateFilterGroupRowCounts();
      }, 100);
      
      return () => clearTimeout(timer);
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
      'IS NOT NULL': 'isNotNull',
      // Add date preset operators with consistent naming convention
      'LAST_1_DAY': 'last_1_day',
      'LAST_7_DAYS': 'last_7_days',
      'LAST_30_DAYS': 'last_30_days',
      'THIS_MONTH': 'this_month',
      'LAST_MONTH': 'last_month',
      'LAST_3_MONTHS': 'last_90_days',
      'LAST_6_MONTHS': 'last_6_months',
      'LAST_12_MONTHS': 'last_12_months',
      'THIS_YEAR': 'this_year',
      'LAST_YEAR': 'last_year'
    }
    return operatorMap[operator] || operator
  }

  // Add a reverse mapping function to convert backend operator formats to frontend formats
  const mapOperatorFromBackend = (operator: string): string => {
    const operatorMap: { [key: string]: string } = {
      'equals': '=',
      'notEquals': '!=',
      'contains': 'LIKE',
      'notContains': 'NOT LIKE',
      'startsWith': 'STARTS_WITH',
      'notStartsWith': 'NOT_STARTS_WITH',
      'endsWith': 'ENDS_WITH',
      'notEndsWith': 'NOT_ENDS_WITH',
      'greaterThan': '>',
      'greaterThanOrEqual': '>=',
      'lessThan': '<',
      'lessThanOrEqual': '<=',
      'in': 'IN',
      'notIn': 'NOT_IN',
      'between': 'BETWEEN',
      'notBetween': 'NOT_BETWEEN',
      'isNull': 'IS NULL',
      'isNotNull': 'IS NOT NULL',
      // Add date preset operators with consistent naming convention
      'last_1_day': 'LAST_1_DAY',
      'last_7_days': 'LAST_7_DAYS',
      'last_30_days': 'LAST_30_DAYS',
      'this_month': 'THIS_MONTH',
      'last_month': 'LAST_MONTH',
      'last_90_days': 'LAST_3_MONTHS',
      'last_6_months': 'LAST_6_MONTHS',
      'last_12_months': 'LAST_12_MONTHS',
      'this_year': 'THIS_YEAR',
      'last_year': 'LAST_YEAR'
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
    
    if (!segmentData.startDate) {
      toast({
        title: "Error",
        description: "Please select a start date in Execution Timing",
        variant: "destructive",
      });
      return;
    }
    
    if (!segmentData.endDate) {
      toast({
        title: "Error",
        description: "Please select an end date in Execution Timing",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Determine which filter groups to use
      let segmentFilterGroups: FilterGroup[] = [...filterGroups];
      
      // Generate SQL from filters if no custom SQL exists
      const generatedFilterSql = generateSqlFromFilters();
      
      // Use custom SQL if it exists, otherwise use generated SQL
      const sqlToSave = customSql || generatedFilterSql;
      
      // Validate the SQL before saving
      const validatedSql = ensureValidSqlSyntax(sqlToSave);
      
      // Convert our filter groups to API format
      const apiFilterGroups = segmentFilterGroups.map((group, index) => {
        // Determine if this is a NOT condition
        const isNotCondition = group.condition === "NOT";
        
        // Get the between-group condition for this group
        const betweenGroupCondition = index > 0 && index - 1 < betweenGroupConditions.length 
          ? betweenGroupConditions[index - 1] 
          : "AND";
        
        return {
          group_name: group.name || `Group ${index + 1}`,
          group_order: index + 1,
          // When saving a NOT condition group:
          // 1. We store the actual condition (NOT)
          // 2. We set the not flag to true to indicate negation
          // 3. The backend will join filters with AND and then apply NOT to the entire group
          group_condition: group.condition, // Use the actual condition directly
          not: isNotCondition, // Set NOT flag for NOT condition
          between_group_condition: betweenGroupCondition,
          filters: group.filters.map((filter: any, filterIndex: number) => {
            // Determine value format based on operator
            let filterValue = filter.value;
            let filterValue2 = filter.value2;
            let datePreset = null;
            
            // Check if this is a date preset operator
            const isDatePresetOperator = [
              "LAST_1_DAY",
              "LAST_7_DAYS", 
              "LAST_30_DAYS", 
              "THIS_MONTH", 
              "LAST_MONTH",
              "LAST_3_MONTHS", 
              "LAST_6_MONTHS", 
              "THIS_YEAR", 
              "LAST_YEAR",
              "LAST_12_MONTHS"
            ].includes(filter.operator);
            
            if (isDatePresetOperator) {
              // For date presets, set the date_preset property
              datePreset = mapOperatorToBackend(filter.operator);
            } else if (filter.operator === 'BETWEEN' || filter.operator === 'NOT_BETWEEN') {
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
              is_active: true,
              date_preset: datePreset
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
        generated_sql: validatedSql, // Always save the SQL (custom or generated)
        custom_sql: customSql ? validatedSql : null, // Only save as custom SQL if it was edited
        is_template: false,
        is_saved_table: true,
        filter_groups: apiFilterGroups,
        status: segmentData.status || "active" // Use the stored status instead of hardcoding "active"
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-6">
            <div className="relative">
              <div className="w-24 h-24 mx-auto relative">
                {/* Outer ring animation */}
                <div className="absolute inset-0 rounded-full border-8 border-violet-200 dark:border-violet-800/40"></div>
                <div className="absolute inset-0 rounded-full border-8 border-transparent border-t-violet-600 dark:border-t-violet-400 animate-spin"></div>
                
                {/* Middle ring animation - opposite direction */}
                <div className="absolute inset-2 rounded-full border-6 border-violet-100 dark:border-violet-900/30"></div>
                <div className="absolute inset-2 rounded-full border-6 border-transparent border-b-indigo-500 dark:border-b-indigo-400 animate-spin animate-duration-[1.5s] animate-reverse"></div>
                
                {/* Inner pulsing circle */}
                <div className="absolute inset-5 rounded-full bg-gradient-to-br from-violet-600 to-indigo-500 animate-pulse"></div>
                
                {/* Icon */}
                <Database className="h-8 w-8 text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-md" />
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-lg font-medium bg-gradient-to-r from-violet-600 to-indigo-400 bg-clip-text text-transparent">Loading table data...</p>
              <div className="flex justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-600 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></span>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const enabledFilterCount = filterGroups.filter((g) => g.isEnabled !== false).length
  const totalFilterCount = filterGroups.reduce((sum, group) => sum + group.filters.length, 0)

  // Render pagination controls
  const renderPagination = () => {
    const { page, pageSize, total, totalPages } = pagination;
    const startRecord = ((page - 1) * pageSize) + 1;
    const endRecord = Math.min(page * pageSize, total);
    
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-4 pb-4 bg-violet-50/50 dark:bg-violet-900/10 rounded-lg border border-violet-200 dark:border-violet-800 py-3">
        <div className="text-sm font-medium flex items-center">
          <span className="text-muted-foreground mr-2">Showing</span> 
          <span className="px-2 py-1 rounded bg-violet-500/10 text-violet-700 dark:text-violet-300">{startRecord}-{endRecord}</span> 
          <span className="text-muted-foreground mx-2">of</span> 
          <span className="px-2 py-1 rounded bg-violet-500/10 text-violet-700 dark:text-violet-300">{total.toLocaleString()}</span> 
          <span className="text-muted-foreground ml-2">records</span>
        </div>
        <div className="flex items-center gap-3">
          <Select 
            value={pageSize.toString()} 
            onValueChange={(value) => handlePageSizeChange(parseInt(value))}
          >
            <SelectTrigger className="w-[120px] h-8 border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30">
              <SelectValue placeholder="Rows per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="20">20 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
              <SelectItem value="500">500 per page</SelectItem>
              <SelectItem value="1000">1000 per page</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-1 bg-violet-500/5 p-1 rounded-md border border-violet-300 dark:border-violet-700">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300" 
              onClick={() => handlePageChange(1)}
              disabled={page === 1}
            >
              <span className="sr-only">First Page</span>
              <ChevronFirst className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300" 
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
                <SelectTrigger className="h-7 min-w-8 border-none px-2 py-0.5 rounded bg-violet-500/10 text-violet-700 dark:text-violet-300 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 mx-1.5 hover:bg-violet-500/20 transition-colors">
                  <SelectValue placeholder={page.toLocaleString()} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {totalPages <= 100 ? (
                    // For reasonable number of pages, show all
                    Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <SelectItem key={pageNum} value={String(pageNum)}>
                        {pageNum.toLocaleString()}
                      </SelectItem>
                    ))
                  ) : (
                    // For large number of pages, show strategic page numbers
                    <>
                      {/* First few pages */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((pageNum) => (
                        <SelectItem 
                          key={`first-${pageNum}`} 
                          value={String(pageNum)}
                          className={pageNum === page ? "bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium" : ""}
                        >
                          {pageNum.toLocaleString()}
                        </SelectItem>
                      ))}
                      
                      {/* Separator */}
                      {totalPages > 10 && (
                        <SelectItem disabled value="separator-1" className="h-0 py-0 my-1 border-b border-muted/50">
                          <span className="sr-only">Separator</span>
                        </SelectItem>
                      )}
                      
                      {/* Strategic page numbers based on dataset size */}
                      {generateStrategicPageNumbers(totalPages).filter(
                        num => num > 5 && num < totalPages - 5 && Math.abs(num - page) > 5
                      ).map((pageNum) => (
                        <SelectItem 
                          key={`strategic-${pageNum}`} 
                          value={String(pageNum)}
                          className={pageNum === page ? "bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium" : ""}
                        >
                          {pageNum.toLocaleString()}
                        </SelectItem>
                      ))}
                      
                      {/* Separator before current page section */}
                      {page > 10 && (
                        <SelectItem disabled value="separator-2" className="h-0 py-0 my-1 border-b border-muted/50">
                          <span className="sr-only">Separator</span>
                        </SelectItem>
                      )}
                      
                      {/* Pages around current page */}
                      {page > 5 && page < totalPages - 5 && 
                        Array.from(
                          { length: 5 }, 
                          (_, i) => page - 2 + i
                        )
                        .filter(num => num > 0 && num <= totalPages)
                        .map((pageNum) => (
                          <SelectItem 
                            key={`current-${pageNum}`} 
                            value={String(pageNum)}
                            className={pageNum === page ? "bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium" : ""}
                          >
                            {pageNum.toLocaleString()}
                          </SelectItem>
                        ))
                      }
                      
                      {/* Separator before last pages */}
                      {page < totalPages - 10 && (
                        <SelectItem disabled value="separator-3" className="h-0 py-0 my-1 border-b border-muted/50">
                          <span className="sr-only">Separator</span>
                        </SelectItem>
                      )}
                      
                      {/* Last few pages */}
                      {Array.from(
                        { length: Math.min(5, totalPages) }, 
                        (_, i) => totalPages - Math.min(4, totalPages - 1) + i
                      )
                      .filter(num => num > Math.max(page + 5, 5) && num <= totalPages)
                      .map((pageNum) => (
                        <SelectItem 
                          key={`last-${pageNum}`} 
                          value={String(pageNum)}
                          className={pageNum === page ? "bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium" : ""}
                        >
                          {pageNum.toLocaleString()}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              </span>
              <span className="text-muted-foreground mr-1">of</span>
              <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-700 dark:text-violet-300 text-center">{totalPages.toLocaleString()}</span>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300" 
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <span className="sr-only">Next Page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300" 
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

  // Helper function to generate strategic page numbers for large datasets
  const generateStrategicPageNumbers = (totalPages: number) => {
    const strategicNumbers: number[] = [];
    
    // For very large datasets, use exponential distribution
    if (totalPages > 10000) {
      // Add powers of 10
      for (let i = 1; i <= 6; i++) {
        const num = Math.pow(10, i);
        if (num < totalPages) {
          strategicNumbers.push(num);
        }
      }
      
      // Add multiples of 10000
      for (let i = 2; i <= 10; i++) {
        const num = i * 10000;
        if (num < totalPages - 10000) {
          strategicNumbers.push(num);
        }
      }
      
      // Add multiples of 100000 for very large datasets
      if (totalPages > 100000) {
        for (let i = 2; i <= 10; i++) {
          const num = i * 100000;
          if (num < totalPages - 10000) {
            strategicNumbers.push(num);
          }
        }
      }
      
      // Add quarter, third, half points
      strategicNumbers.push(Math.floor(totalPages / 4));
      strategicNumbers.push(Math.floor(totalPages / 3));
      strategicNumbers.push(Math.floor(totalPages / 2));
      strategicNumbers.push(Math.floor(totalPages * 2 / 3));
      strategicNumbers.push(Math.floor(totalPages * 3 / 4));
    } 
    // For medium-sized datasets
    else if (totalPages > 1000) {
      // Add hundreds
      for (let i = 1; i <= 9; i++) {
        const num = i * 1000;
        if (num < totalPages - 1000) {
          strategicNumbers.push(num);
        }
      }
      
      // Add quarter, third, half points
      strategicNumbers.push(Math.floor(totalPages / 4));
      strategicNumbers.push(Math.floor(totalPages / 2));
      strategicNumbers.push(Math.floor(totalPages * 3 / 4));
    }
    // For smaller large datasets
    else {
      // Add hundreds
      for (let i = 1; i <= 9; i++) {
        const num = i * 100;
        if (num < totalPages - 100) {
          strategicNumbers.push(num);
        }
      }
      
      // Add quarter, half, three-quarter points
      strategicNumbers.push(Math.floor(totalPages / 4));
      strategicNumbers.push(Math.floor(totalPages / 2));
      strategicNumbers.push(Math.floor(totalPages * 3 / 4));
    }
    
    // Remove duplicates and sort
    return [...new Set(strategicNumbers)].sort((a, b) => a - b);
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
          <div className="flex items-center justify-between py-2 mb-4 border-b border-violet-200 dark:border-violet-800">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" className="px-2 h-8 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-300" onClick={() => router.back()}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                <span className="text-sm">Back</span>
              </Button>
              <h1 className="text-2xl font-bold flex items-center bg-gradient-to-r from-violet-600 to-indigo-400 bg-clip-text text-transparent">
                <div className="h-8 w-8 rounded-md bg-violet-500/10 flex items-center justify-center mr-2.5">
                  <Database className="h-4.5 w-4.5 text-violet-600" />
                </div>
                {tableName}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-sm border-violet-400/30 hover:border-violet-400/40 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-300" onClick={() => setShowSqlEditor(!showSqlEditor)}>
                    <Code className="h-3.5 w-3.5 mr-1.5 text-violet-600" />
                    {showSqlEditor ? "Hide" : "Show"} SQL Editor
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle SQL editor view</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" className="h-8 text-sm bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white" onClick={executeQuery} disabled={executing}>
                    {executing ? <Zap className="h-3.5 w-3.5 mr-1.5 animate-pulse" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                    {executing ? "Running..." : "Run Query"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Execute current filters and SQL</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" className="h-8 text-sm bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white" onClick={() => setShowSaveDialog(true)}>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {segmentId ? "Update Segment" : "Save Segment"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{segmentId ? "Update existing segment" : "Save current configuration as a segment"}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex-1 h-[calc(100vh-12rem)] overflow-hidden">
            <ResizablePanelGroup
              direction="horizontal"
              className="h-full rounded-lg border border-violet-200 dark:border-violet-800 overflow-hidden"
            >
              {/* Left Sidebar - Filters - Resizable panel */}
              <ResizablePanel defaultSize={30} minSize={20} maxSize={50} className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 flex flex-col h-full overflow-hidden pr-2">
                  {/* Filter Groups Header */}
                  <Card className={cn("border mb-4 sticky top-0 z-10", gradientCardStyles({ variant: "primary" }))}>
                    <CardHeader className="py-3 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border-b border-violet-100 dark:border-violet-800">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center space-x-2 text-base text-violet-900 dark:text-violet-100">
                          <div className="h-6 w-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                            <Layers className="h-3.5 w-3.5 text-violet-600" />
                          </div>
                          <span>Filter Groups</span>
                        </CardTitle>
                        <div className="flex items-center space-x-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" className="h-7 w-7 p-0 rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white" onClick={addFilterGroup}>
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
                      <Card className="border-dashed border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/10">
                        <CardContent className="text-center py-12">
                          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-violet-500/10 flex items-center justify-center">
                            <FilterIcon className="h-8 w-8 text-violet-600 opacity-70" />
                          </div>
                          <h3 className="font-medium mb-2 text-violet-900 dark:text-violet-100">No filter groups yet</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Create your first filter group to start building your segment
                          </p>
                          <Button onClick={addFilterGroup} className="bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white">
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
                                <SelectTrigger className="w-24 border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30">
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
                  <Card className="border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/50 to-indigo-50/50 dark:from-violet-950/20 dark:to-indigo-950/20 mt-4 sticky bottom-0">
                    <CardHeader className="py-3">
                      <CardTitle className="flex items-center text-base text-violet-900 dark:text-violet-100">
                        <div className="h-6 w-6 rounded-md bg-violet-500/10 flex items-center justify-center mr-2">
                          <CalendarIcon className="h-3.5 w-3.5 text-violet-600" />
                        </div>
                        Execution Timing
                      </CardTitle>
                      <CardDescription className="text-xs text-violet-500/70">
                        Configure when this segment should be executed (required)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pb-4">
                      {/* Responsive layout that switches to single column on narrow widths */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="startDate" className="text-xs mb-1 block text-violet-700 dark:text-violet-300 font-medium">
                            Start Date <span className="text-red-500">*</span>
                          </Label>
                          <DatePicker 
                            date={segmentData.startDate} 
                            setDate={(date) => setSegmentData({ ...segmentData, startDate: date })}
                            isRequired={true}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="endDate" className="text-xs mb-1 block text-violet-700 dark:text-violet-300 font-medium">
                            End Date <span className="text-red-500">*</span>
                          </Label>
                          <DatePicker 
                            date={segmentData.endDate} 
                            setDate={(date) => setSegmentData({ ...segmentData, endDate: date })}
                            isRequired={true}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="startTime" className="text-xs mb-1 block text-violet-700 dark:text-violet-300 font-medium">
                            Start Time
                          </Label>
                          <TimePicker
                            time={segmentData.startTime}
                            setTime={(time) => setSegmentData({ ...segmentData, startTime: time })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="endTime" className="text-xs mb-1 block text-violet-700 dark:text-violet-300 font-medium">
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
                        <div className="mt-3 p-2 rounded-md bg-violet-500/10 border border-violet-200 dark:border-violet-800 text-xs">
                          <div className="flex items-center text-violet-700 dark:text-violet-300">
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
                            {(segmentData.startTime !== "00:00" || segmentData.endTime !== "23:59") }
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </ResizablePanel>

              {/* Resize handle with custom styling */}
              <ResizableHandle 
                className="w-1.5 bg-violet-200/50 dark:bg-violet-800/50 transition-colors hover:bg-violet-300 dark:hover:bg-violet-700 focus-visible:ring-violet-500/30"
                withHandle 
              />

              {/* Right Side - Data View */}
              <ResizablePanel defaultSize={70} className="overflow-y-auto space-y-4 pl-2">
                {showSqlEditor && (
                  <div className="p-4 border rounded-lg bg-background mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">SQL Editor</h3>
                      {/* <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetSqlEditor}
                        >
                          Reset to Generated SQL
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={executeQuery}
                          disabled={executing}
                        >
                          {executing ? "Executing..." : "Execute SQL"}
                        </Button>
                      </div> */}
                    </div>
                    
                    <SqlEditor
                      sql={customSql || generateSqlFromFilters()}
                      onChange={setCustomSql}
                      onExecute={executeQuery}
                      onReset={resetSqlEditor}
                    />
                  </div>
                )}

                {/* Data Preview */}
                <Card className="border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/50 to-indigo-50/50 dark:from-violet-950/20 dark:to-indigo-950/20">
                  <CardHeader>
                    <div className="flex items-center justify-between flex-col sm:flex-row gap-2">
                      <CardTitle className="flex items-center text-violet-900 dark:text-violet-100">
                        <div className="h-6 w-6 rounded-md bg-violet-500/10 flex items-center justify-center mr-2">
                          <Eye className="h-3.5 w-3.5 text-violet-600" />
                        </div>
                        Data Preview
                      </CardTitle>
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <div className="flex flex-col items-center px-4 py-2 bg-violet-500/10 rounded-md border border-violet-200 dark:border-violet-800">
                            <span className="text-lg font-semibold text-violet-700 dark:text-violet-300">{pagination.total.toLocaleString('en-US')}</span>
                            <span className="text-xs text-muted-foreground">Overall Rows</span>
                          </div>
                          <div className="flex flex-col items-center px-4 py-2 bg-violet-500/10 rounded-md border border-violet-200 dark:border-violet-800">
                            <span className="text-lg font-semibold text-violet-700 dark:text-violet-300">{(columns?.length || 0).toLocaleString('en-US')}</span>
                            <span className="text-xs text-muted-foreground">Columns</span>
                          </div>
                          {hasEmailColumn && (
                            <div className="flex flex-col items-center px-4 py-2 bg-violet-500/10 rounded-md border border-violet-200 dark:border-violet-800">
                              <span className="text-lg font-semibold text-violet-700 dark:text-violet-300">{uniqueEmails !== null ? uniqueEmails.toLocaleString('en-US') : '0'}</span>
                              <span className="text-xs text-muted-foreground">Unique emails</span>
                            </div>
                          )}
                          {enabledFilterCount > 0 && (
                            <div className="flex flex-col items-center px-4 py-2 bg-violet-500/10 rounded-md border border-violet-200 dark:border-violet-800">
                              <span className="text-lg font-semibold text-violet-700 dark:text-violet-300">{enabledFilterCount.toLocaleString('en-US')}</span>
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
                              className="flex items-center gap-1 border-violet-300 dark:border-violet-700 hover:border-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                            >
                              <Download className="h-4 w-4 text-violet-600" />
                              Export Page
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 sm:p-0">
                      <div className="space-y-4">
                        <div className="rounded-md border border-violet-200 dark:border-violet-800 overflow-hidden relative">
                          {(tableLoading || executing) && (
                            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
                              <div className="flex flex-col items-center gap-3">
                                <div className="relative">
                                  {/* Spinner with gradient */}
                                  <div className="h-16 w-16 rounded-full border-4 border-violet-100 dark:border-violet-800/30 relative">
                                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-600 dark:border-t-violet-400 animate-spin"></div>
                                    <div className="absolute inset-1 rounded-full border-4 border-transparent border-b-indigo-500 dark:border-b-indigo-400 animate-spin animate-duration-[1.2s] animate-reverse"></div>
                                    <div className="absolute inset-3 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 animate-pulse"></div>
                                  </div>
                                  
                                  {/* Progress bar animation */}
                                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-1 bg-violet-100 dark:bg-violet-800/30 rounded-full overflow-hidden">
                                    <div className="h-full w-10 bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full animate-progress"></div>
                                  </div>
                                </div>
                                <div className="text-center space-y-1">
                                  <p className="text-sm font-medium text-violet-700 dark:text-violet-300">
                                    {executing ? "Executing query..." : "Loading data..."}
                                  </p>
                                  <p className="text-xs text-muted-foreground">This may take a moment</p>
                                </div>
                              </div>
                            </div>
                          )}
                          <DataTable data={tableData || []} columns={columns || []} />
                        </div>
                        {renderPagination()}
                      </div>
                  </CardContent>
                </Card>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          {/* Save Segment Dialog */}
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogContent className="bg-gradient-to-br from-white to-violet-50 dark:from-gray-950 dark:to-violet-950/30 border-violet-200 dark:border-violet-800">
              <DialogHeader>
                <DialogTitle className="flex items-center text-violet-900 dark:text-violet-100">
                  <div className="h-7 w-7 rounded-md bg-violet-500/10 flex items-center justify-center mr-2">
                    <Save className="h-4 w-4 text-violet-600" />
                  </div>
                  {segmentId ? "Update Segment" : "Save Segment"}
                </DialogTitle>
                <DialogDescription>
                  Give your segment a name and description to {segmentId ? "update" : "save"} it for future use. Start date and end date are required.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="segmentName" className="text-violet-700 dark:text-violet-300">Segment Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="segmentName"
                    value={segmentData.name}
                    onChange={(e) => setSegmentData({ ...segmentData, name: e.target.value })}
                    placeholder="Enter segment name"
                    className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30"
                  />
                </div>
                <div>
                  <Label htmlFor="segmentDescription" className="text-violet-700 dark:text-violet-300">Description</Label>
                  <Textarea
                    id="segmentDescription"
                    value={segmentData.description}
                    onChange={(e) => setSegmentData({ ...segmentData, description: e.target.value })}
                    placeholder="Describe what this segment represents"
                    rows={3}
                    className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30"
                  />
                </div>
                <Separator className="bg-violet-200 dark:bg-violet-800" />
                <div className="text-sm space-y-2 p-3 rounded-md bg-violet-50/50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Table:</span>
                    <span className="font-medium text-violet-700 dark:text-violet-300">{tableName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Filter Groups:</span>
                    <span className="font-medium text-violet-700 dark:text-violet-300">
                      {enabledFilterCount} active, {filterGroups.length} total
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Filters:</span>
                    <span className="font-medium text-violet-700 dark:text-violet-300">{totalFilterCount}</span>
                  </div>
                  {(segmentData.startDate || segmentData.endDate) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Execution Period:</span>
                      <span className="font-medium text-violet-700 dark:text-violet-300">
                        {segmentData.startDate || "No start"} to {segmentData.endDate || "No end"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSaveDialog(false)} className="border-violet-300 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                  Cancel
                </Button>
                <Button onClick={saveSegment} disabled={saving} className="bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white">
                  {saving ? (segmentId ? "Updating..." : "Saving...") : segmentId ? "Update Segment" : "Save Segment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  )
}