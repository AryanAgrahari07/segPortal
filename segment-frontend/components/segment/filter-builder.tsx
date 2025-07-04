"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Trash2, Hash, Type, ToggleLeft, Search, Loader2, ChevronDown, Clock } from "lucide-react"
import { Calendar as CalendarIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { dataService } from "@/services/data-service"
import { useParams, useSearchParams } from "next/navigation"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Import the Calendar component
import { Calendar } from "@/components/ui/calendar"

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

// Define operators function at the top level
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

// Enhanced debounce helper function
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Simplified throttle function
function throttle<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    if (timeSinceLastCall >= delay) {
      lastCall = now;
      fn(...args);
    } else {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
        timeoutId = null;
      }, delay - timeSinceLastCall);
    }
  };
}

// Add DatePicker component for timestamp fields
function DatePicker({ 
  date, 
  setDate, 
  className 
}: { 
  date: string, 
  setDate: (date: string) => void,
  className?: string 
}) {
  // Parse the input date string to a Date object, or use current date if empty/invalid
  const parseDateString = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    
    // Handle YYYY-MM-DD format specifically to avoid timezone issues
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      // Create date using local timezone (months are 0-indexed in JS Date)
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  // Initialize state with parsed date
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    date ? parseDateString(date) : undefined
  );
   
  // Keep the visible month in sync with selected date
  const [currentMonth, setCurrentMonth] = useState<Date>(
    date ? parseDateString(date) : new Date()
  );
  
  // Generate years for dropdown (10 years before and after current year)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  // Handle date selection - critical fix for timezone issues
  const handleSelect = (newDate: Date | undefined) => {
    setSelectedDate(newDate);
    
    if (newDate) {
      // Format as YYYY-MM-DD using local timezone to avoid date shifts
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
      const day = String(newDate.getDate()).padStart(2, '0');
      
      const formattedDate = `${year}-${month}-${day}`;
      setDate(formattedDate);
      
      // Also update the current month to match the selected date
      setCurrentMonth(newDate);
    }
  };

  // Handle year change
  const handleYearChange = (year: string) => {
    // Create a new date with the selected year but preserve month and day
    const newMonth = new Date(currentMonth);
    newMonth.setFullYear(parseInt(year));
    setCurrentMonth(newMonth);
  };

  // Format date for display - use shorter month format to prevent overflow
  const formatDate = (date: Date): string => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short', // Use short month format (Feb instead of February)
        day: 'numeric'
      }).format(date);
    } catch (e) {
      console.error("Date formatting error:", e);
      return "Invalid date";
    }
  };

  // Update internal state when external date prop changes
  useEffect(() => {
    if (date) {
      const parsedDate = parseDateString(date);
      setSelectedDate(parsedDate);
      setCurrentMonth(parsedDate);
    } else {
      setSelectedDate(undefined);
    }
  }, [date]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-9 border-purple-500/20 focus-visible:ring-purple-500/30 truncate",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0 text-purple-500" />
          <span className="truncate">
            {selectedDate ? formatDate(selectedDate) : "Pick a date"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b border-border/20 flex justify-between items-center">
          <span className="text-sm font-medium">Go to year</span>
          <Select 
            value={currentMonth.getFullYear().toString()} 
            onValueChange={handleYearChange}
          >
            <SelectTrigger className="h-8 w-[5rem] px-2 text-xs border-purple-500/20 focus-visible:ring-purple-500/30">
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
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          initialFocus
          className="border-none shadow-none"
          classNames={{
            caption: "flex justify-center py-2 relative items-center",
            caption_label: "text-sm font-medium",
            cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
            day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-purple-100 dark:hover:bg-purple-900/20",
            day_selected: "bg-purple-500 text-white hover:bg-purple-400 hover:text-white focus:bg-purple-500 focus:text-white",
            day_today: "bg-purple-100 text-purple-700 dark:bg-purple-800/30 dark:text-purple-300",
            head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-purple-500"
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// Add TimePicker component for timestamp fields
function TimePicker({
  time,
  setTime,
  className
}: {
  time: string,
  setTime: (time: string) => void,
  className?: string
}) {
  // Parse current time into hours and minutes, with fallback to 00:00
  const parseTimeString = (timeStr: string): [number, number] => {
    if (!timeStr) return [0, 0];
    const parts = timeStr.split(':').map(Number);
    const hours = !isNaN(parts[0]) && parts[0] >= 0 && parts[0] < 24 ? parts[0] : 0;
    const minutes = !isNaN(parts[1]) && parts[1] >= 0 && parts[1] < 60 ? parts[1] : 0;
    return [hours, minutes];
  };

  const [hours, minutes] = parseTimeString(time);
  
  // Format numbers with leading zeros
  const formatNumber = (num: number, digits: number = 2): string => {
    return num.toString().padStart(digits, '0');
  };

  // Handle hour and minute changes
  const handleHourChange = (newHour: string) => {
    const hourNum = parseInt(newHour, 10);
    if (!isNaN(hourNum) && hourNum >= 0 && hourNum < 24) {
      setTime(`${formatNumber(hourNum)}:${formatNumber(minutes)}`);
    }
  };

  const handleMinuteChange = (newMinute: string) => {
    const minuteNum = parseInt(newMinute, 10);
    if (!isNaN(minuteNum) && minuteNum >= 0 && minuteNum < 60) {
      setTime(`${formatNumber(hours)}:${formatNumber(minuteNum)}`);
    }
  };

  // Generate hour and minute options
  const hourOptions = Array.from({ length: 24 }, (_, i) => formatNumber(i));
  const minuteOptions = Array.from({ length: 60 }, (_, i) => formatNumber(i));

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="w-full flex items-center h-9 px-3 py-2 rounded-md border border-purple-500/20 bg-transparent text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/30 focus-visible:ring-offset-2">
        <Clock className="mr-2 h-4 w-4 flex-shrink-0 text-purple-500" />
        <div className="flex items-center">
          <Select value={formatNumber(hours)} onValueChange={handleHourChange}>
            <SelectTrigger className="w-[3.5rem] h-7 px-2 text-center border-0 focus:ring-0 shadow-none">
              <SelectValue placeholder="HH" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {hourOptions.map((hour) => (
                <SelectItem key={hour} value={hour}>
                  {hour}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="mx-1 text-purple-500">:</span>
          <Select value={formatNumber(minutes)} onValueChange={handleMinuteChange}>
            <SelectTrigger className="w-[3.5rem] h-7 px-2 text-center border-0 focus:ring-0 shadow-none">
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
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

export function FilterBuilder({ filter, columns, onUpdate, onRemove, disabled = false }: FilterBuilderProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const tableName = params?.tableName as string;
  const segmentId = searchParams?.get("segment");
  
  // Refs to prevent unnecessary re-renders
  const requestIdRef = useRef(0);
  const activeRequestRef = useRef<AbortController | null>(null);
  const isFirstRenderRef = useRef(true);
  
  const selectedColumn = useMemo(() => columns.find((col) => col.name === filter.column), [columns, filter.column]);
  const [uniqueValues, setUniqueValues] = useState<string[]>([]);
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const [hasMoreValues, setHasMoreValues] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [visibleValues, setVisibleValues] = useState<string[]>([]);
  
  // Request tracking refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestCountRef = useRef(0);
  const lastRequestTimeRef = useRef(0);
  const isRequestInProgressRef = useRef(false);

  // Use the top-level getOperatorsForType function
  const operators = useMemo(() => getOperatorsForType(selectedColumn?.type || "STRING"), [selectedColumn?.type]);
  const needsSecondValue = filter.operator === "BETWEEN" || filter.operator === "NOT_BETWEEN";
  const needsNoValue = filter.operator === "IS NULL" || filter.operator === "IS NOT NULL";
  const isListType = filter.operator === "IN" || filter.operator === "NOT_IN";

  // Calculate visible items based on scroll position - simple virtualization
  useEffect(() => {
    if (!dropdownRef.current || uniqueValues.length === 0) return;
    
    // Set initial visible values when data changes
    setVisibleValues(uniqueValues.slice(0, Math.min(30, uniqueValues.length)));
  }, [uniqueValues]);

  const fetchUniqueValues = useCallback(async (page: number) => {
    if (!filter.column || needsNoValue) return;
    
    // Rate limiting - don't allow requests more often than every 300ms
    const now = Date.now();
    if (now - lastRequestTimeRef.current < 300 && page > 1) {
      return;
    }
    
    // Don't allow concurrent requests
    if (isRequestInProgressRef.current) {
      return;
    }
    
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Track this request
    const requestId = ++requestCountRef.current;
    lastRequestTimeRef.current = now;
    isRequestInProgressRef.current = true;
    
    setIsLoadingValues(true);
    
    try {
      // Use setTimeout to ensure the UI remains responsive
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check if request was aborted during the timeout
      if (abortController.signal.aborted) {
        return;
      }
      
      const response = await dataService.getUniqueColumnValues(
        tableName, 
        filter.column, 
        {
          page,
          limit: 25,
          search: debouncedSearchTerm,
          segmentId: segmentId || undefined
        }
      );
      
      // Check if request was aborted or if a newer request has been made
      if (abortController.signal.aborted || requestId !== requestCountRef.current) {
        return;
      }
      
      const data = response.data || [];
      
      // Update state in microtasks to avoid freezing
      setTimeout(() => {
        if (data.length === 0 || data.length < 25) {
          setHasMoreValues(false);
        } else {
          setHasMoreValues(true);
        }
  
        if (page === 1) {
          setUniqueValues(data);
        } else {
          setUniqueValues(prev => [...prev, ...data]);
        }
        
        setCurrentPage(page);
        
        // Reset loading state and request tracking
        setIsLoadingValues(false);
        isRequestInProgressRef.current = false;
      }, 0);
      
    } catch (error) {
      // Ignore aborted request errors
      if ((error as any)?.name === 'AbortError') {
        return;
      }
      
      console.error("Error fetching unique values:", error);
      
      // Reset loading state and request tracking
      setIsLoadingValues(false);
      isRequestInProgressRef.current = false;
    }
  }, [filter.column, debouncedSearchTerm, needsNoValue, tableName, segmentId]);

  // Optimized scroll handler with debounce built-in
  const handleScroll = useCallback(() => {
    if (!dropdownRef.current || !hasMoreValues || isLoadingValues || isRequestInProgressRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = dropdownRef.current;
    
    // Only trigger when scrolled past 70% of the container
    if (scrollTop + clientHeight > scrollHeight * 0.7) {
      fetchUniqueValues(currentPage + 1);
    }
  }, [hasMoreValues, isLoadingValues, currentPage, fetchUniqueValues]);

  // Clear values whenever column changes
  useEffect(() => {
    setUniqueValues([]);
    setVisibleValues([]);
    setCurrentPage(1);
    setHasMoreValues(true);
    setSearchTerm('');
    setIsDropdownOpen(false);
    
    // Clean up previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    isRequestInProgressRef.current = false;
  }, [filter.column]);

  // Fetch unique values when column or operator changes
  useEffect(() => {
    // Clean up previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    isRequestInProgressRef.current = false;
    
    if (filter.column && !needsNoValue) {
      setUniqueValues([]);
      setCurrentPage(1);
      setHasMoreValues(true);
      
      // Small delay to ensure UI remains responsive
      setTimeout(() => {
        fetchUniqueValues(1);
      }, 50);
    }
  }, [filter.column, filter.operator, needsNoValue, fetchUniqueValues]);

  // Fetch more values when search term changes (debounced)
  useEffect(() => {
    if (!isDropdownOpen || !filter.column || needsNoValue) return;
    
    // Clean up previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    isRequestInProgressRef.current = false;
    setUniqueValues([]);
    setCurrentPage(1);
    setHasMoreValues(true);
    
    // Small delay to ensure UI remains responsive
    setTimeout(() => {
      fetchUniqueValues(1);
    }, 50);
  }, [debouncedSearchTerm, isDropdownOpen, filter.column, needsNoValue, fetchUniqueValues]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // getOperatorsForType function is now defined at the top level

  const getInputType = (columnType: string) => {
    switch (columnType) {
      case "INTEGER":
        return "number"
      case "DECIMAL":
        return "number"
      case "TIMESTAMP":
        return "date"
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
        return <CalendarIcon className="h-3 w-3" />
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

  // Determine if we should show the dropdown or not based on column type and operator
  const shouldShowDropdown = () => {
    if (needsNoValue) return false;
    if (needsSecondValue) return false;
    if (selectedColumn?.type === "BOOLEAN") return false; 
    if (isListType) return false; // We don't show dropdown for IN operators since they use comma-separated values
    
    return true;
  }
  
  // We need the direct input field without dropdown for these cases
  const shouldShowDirectInput = () => {
    if (needsNoValue) return false;
    if (needsSecondValue) return true;
    if (selectedColumn?.type === "BOOLEAN") return false;
    if (isListType) return true;
    
    return false;
  }

  // Handle selection without re-rendering the entire list
  const handleValueSelect = useCallback((value: string) => {
    onUpdate({ value });
    setIsDropdownOpen(false);
  }, [onUpdate]);

  // Simplified dropdown implementation
  const renderDropdown = () => {
    return (
      <Popover open={isDropdownOpen} onOpenChange={(open) => {
        setIsDropdownOpen(open);
        
        // If opening dropdown and we have no values, fetch them
        if (open && filter.column && !needsNoValue && uniqueValues.length === 0) {
          setTimeout(() => {
            fetchUniqueValues(1);
          }, 50);
        }
      }}>
        <PopoverTrigger asChild>
          <div className="relative flex w-full max-w-[280px]">
            <Input
              type="text"
              value={filter.value || ""}
              onChange={(e) => onUpdate({ value: e.target.value })}
              placeholder="Enter or select a value"
              className="h-9 text-sm pr-9 w-full"
              disabled={disabled}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 h-9 w-9"
              disabled={disabled}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0">
          <div className="border-b border-border/10 px-3 py-2">
            <Input
              placeholder="Search or type a custom value..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 focus-visible:ring-0 border-0 focus-visible:ring-offset-0 text-sm px-2"
              onKeyDown={(e) => {
                // Apply custom value when user presses Enter
                if (e.key === 'Enter') {
                  onUpdate({ value: searchTerm });
                  setIsDropdownOpen(false);
                }
              }}
            />
          </div>
          <div 
            className="h-[200px] overflow-y-auto py-1 px-1" 
            ref={dropdownRef}
            onScroll={handleScroll}
          >
            {/* Allow using the current search term as a custom value */}
            {searchTerm && (
              <div className="border-b border-border/10 pb-1 mb-1">
                <button
                  className="w-full text-left px-2 py-1.5 text-sm rounded-sm bg-primary/10 hover:bg-primary/20 hover:text-accent-foreground cursor-default focus:bg-primary/20 focus:text-accent-foreground focus:outline-none"
                  onClick={() => {
                    onUpdate({ value: searchTerm });
                    setIsDropdownOpen(false);
                  }}
                >
                  <span className="font-medium">Use custom value:</span> {searchTerm}
                </button>
              </div>
            )}
            
            {uniqueValues.length === 0 && isLoadingValues ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                <span>Loading values...</span>
              </div>
            ) : uniqueValues.length === 0 && !isLoadingValues ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {searchTerm ? 'No matching values found.' : 'No values found'}
              </div>
            ) : (
              <div className="space-y-1">
                {uniqueValues.map((value, index) => (
                  <button
                    key={`${value}-${index}`}
                    className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-default focus:bg-accent focus:text-accent-foreground focus:outline-none"
                    onClick={() => {
                      onUpdate({ value });
                      setIsDropdownOpen(false);
                    }}
                  >
                    {value}
                  </button>
                ))}
                {isLoadingValues && (
                  <div className="flex items-center justify-center p-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                    <span>Loading more...</span>
                  </div>
                )}
                {!isLoadingValues && hasMoreValues && (
                  <div className="text-center p-2 text-xs text-muted-foreground">
                    Scroll for more
                  </div>
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Add a function to handle timestamp inputs specifically
  const renderTimestampInput = (value: string, onChange: (value: string) => void, placeholder: string) => {
    // Extract date and time parts with better error handling
    const parseDateTime = (dateTimeStr: string): [string, string] => {
      if (!dateTimeStr) return ["", "00:00"];
      
      // Handle ISO format with T separator
      if (dateTimeStr.includes('T')) {
        const [datePart, timePart] = dateTimeStr.split('T');
        return [datePart, timePart.split(':').slice(0, 2).join(':')];
      }
      
      // Handle date-only format
      if (dateTimeStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return [dateTimeStr, "00:00"];
      }
      
      // Handle other formats or return empty
      try {
        // Use local date parsing to avoid timezone issues
        const date = new Date(dateTimeStr);
        if (!isNaN(date.getTime())) {
          // Format as YYYY-MM-DD using local timezone
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          
          return [
            `${year}-${month}-${day}`,
            `${hours}:${minutes}`
          ];
        }
      } catch (e) {
        console.error("Date parsing error:", e);
      }
      
      return ["", "00:00"];
    };
    
    const [datePart, timePart] = parseDateTime(value);
    
    return (
      <div className="flex flex-col gap-2">
        <DatePicker 
          date={datePart} 
          setDate={(date) => {
            // Preserve time part when changing date
            onChange(`${date}T${timePart || "00:00"}`);
          }}
        />
        <TimePicker 
          time={timePart} 
          setTime={(time) => {
            // Preserve date part when changing time
            const date = datePart || new Date().toISOString().split('T')[0];
            onChange(`${date}T${time}`);
          }}
        />
      </div>
    );
  };

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
            <Popover open={isColumnDropdownOpen} onOpenChange={setIsColumnDropdownOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  role="combobox" 
                  className="h-9 text-sm w-full justify-between font-normal"
                  disabled={disabled}
                >
                  {filter.column ? (
                    <div className="flex items-center space-x-2 truncate">
                      <span className={getTypeColor(selectedColumn?.type || "STRING")}>
                        {getColumnIcon(selectedColumn?.type || "STRING")}
                      </span>
                      <span className="truncate">{filter.column}</span>
                    </div>
                  ) : (
                    "Select column"
                  )}
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Search columns..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No columns found.</CommandEmpty>
                    <CommandGroup>
                      {columns.map((column) => (
                        <CommandItem
                          key={column.name}
                          value={column.name}
                          onSelect={(value) => {
                            // When column changes, clear the value
                            onUpdate({ 
                              column: value,
                              value: '',
                              value2: ''
                            });
                            // Close the dropdown after selection
                            setIsColumnDropdownOpen(false);
                          }}
                        >
                          <div className="flex items-center space-x-2 w-full">
                            <span className={getTypeColor(column.type)}>{getColumnIcon(column.type)}</span>
                            <span className="font-medium truncate">{column.name}</span>
                            <Badge variant="outline" className="text-xs whitespace-nowrap flex-shrink-0 ml-auto">
                              {column.type}
                            </Badge>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Operator Selection */}
          <div className="w-[40%] min-w-[100px]">
            <Select 
              value={filter.operator} 
              onValueChange={(value) => {
                // When operator changes, clear the value
                onUpdate({ 
                  operator: value,
                  value: '',
                  value2: ''
                });
              }} 
              disabled={disabled}
            >
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
              <div className="h-9 flex items-center text-sm text-muted-foreground px-3 bg-muted rounded-md max-w-[280px]">
                No value needed
              </div>
            ) : needsSecondValue && selectedColumn?.type === "TIMESTAMP" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-[600px]">
                <div className="space-y-2">
                  <Label className="text-xs block text-purple-600/80 dark:text-purple-400/80 font-medium">From</Label>
                  {renderTimestampInput(
                    filter.value,
                    (value) => onUpdate({ value }),
                    "From"
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs block text-purple-600/80 dark:text-purple-400/80 font-medium">To</Label>
                  {renderTimestampInput(
                    filter.value2 || "",
                    (value) => onUpdate({ value2: value }),
                    "To"
                  )}
                </div>
              </div>
            ) : needsSecondValue ? (
              <div className="grid grid-cols-2 gap-2 max-w-[280px]">
                <Input
                  type={getInputType(selectedColumn?.type || "STRING")}
                  value={filter.value}
                  onChange={(e) => onUpdate({ value: e.target.value })}
                  placeholder="From"
                  className="h-9 text-sm w-full"
                  disabled={disabled}
                />
                <Input
                  type={getInputType(selectedColumn?.type || "STRING")}
                  value={filter.value2 || ""}
                  onChange={(e) => onUpdate({ value2: e.target.value })}
                  placeholder="To"
                  className="h-9 text-sm w-full"
                  disabled={disabled}
                />
              </div>
            ) : selectedColumn?.type === "TIMESTAMP" ? (
              <div className="max-w-[280px]">
                {renderTimestampInput(
                  filter.value,
                  (value) => onUpdate({ value }),
                  getPlaceholder(selectedColumn?.type || "STRING", filter.operator)
                )}
              </div>
            ) : selectedColumn?.type === "BOOLEAN" ? (
              <div className="max-w-[280px]">
              <Select value={filter.value} onValueChange={(value) => onUpdate({ value })} disabled={disabled}>
                <SelectTrigger className="h-9 text-sm truncate">
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
              </div>
            ) : shouldShowDropdown() ? renderDropdown() : shouldShowDirectInput() ? (
              <div className="max-w-[280px]">
                <Input
                  type={getInputType(selectedColumn?.type || "STRING")}
                  value={filter.value}
                  onChange={(e) => onUpdate({ value: e.target.value })}
                  placeholder={getPlaceholder(selectedColumn?.type || "STRING", filter.operator)}
                  className="h-9 text-sm w-full"
                  disabled={disabled}
                />
              </div>
            ) : (
              // This shouldn't occur, but is a fallback
              <div className="max-w-[280px]">
              <Input
                type={getInputType(selectedColumn?.type || "STRING")}
                value={filter.value}
                onChange={(e) => onUpdate({ value: e.target.value })}
                placeholder={getPlaceholder(selectedColumn?.type || "STRING", filter.operator)}
                  className="h-9 text-sm w-full"
                disabled={disabled}
              />
              </div>
            )}
          </div>

          {/* Remove Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove filter</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}
