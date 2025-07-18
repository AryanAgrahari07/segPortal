const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
import { apiInterceptor } from "@/lib/api-interceptor"

interface TableMetadata {
  success?: boolean
  data?: {
    tableName: string
    columns: Array<{
      col_name?: string
      name?: string
      data_type?: string
      type?: string
      nullable?: boolean
      comment?: string | null
    }>
  }
  message?: string
}

// Column visibility interfaces
interface ColumnVisibilityConfig {
  table_name: string;
  column_name: string;
  is_visible: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

interface ColumnVisibilityResponse {
  success: boolean;
  data: ColumnVisibilityConfig[];
  message?: string;
}

interface SegmentResponse {
  success: boolean;
  data: SegmentData;
}

export interface SegmentData {
  segment_id: string;
  table_id: string;
  segment_name: string;
  description: string;
  created_by: string;
  start_time: string;
  end_time: string;
  status: string;
  segment_config: SegmentConfig;
  generated_sql: string;
  custom_sql: string | null;
  is_template: boolean;
  is_saved_table: boolean;
  created_at: string;
  updated_at: string;
  last_executed: string | null;
  filter_groups: FilterGroup[];
  groupConditions?: string[];
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

interface table {
  tableName: string
  database: string
  isTemporary: boolean
}

interface FilterGroup {
  id: string
  segment_id: string
  group_name: string
  group_order: number
  group_condition: string
  description?: string
  created_at: string
  updated_at: string
  filters?: Filter[]
}

interface Filter {
  id: string
  filter_group_id: string
  column_name: string
  column_data_type: string
  filter_operator: string
  filter_value: string
  filter_value_2?: string
  filter_order: number
  is_active: boolean
  date_preset?: string | null
  created_at: string
  updated_at: string
}

class DataService {
  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`
    const token = localStorage.getItem("token")

    // Use the interceptor to handle 401 responses
    const response = await apiInterceptor.fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || "Request failed")
    }

    // Return the complete data to preserve structure
    return data
  }

  async getAllTables(): Promise<{ tables: table[] } | table[] | any> {
    // Add a timestamp to prevent caching issues with schema context
    const timestamp = new Date().getTime();
    return this.makeRequest(`/tables?_=${timestamp}`);
  }

  async getTableMetadata(tableName: string, segmentId?: string | null): Promise<TableMetadata> {
    // Add a timestamp to prevent caching issues with schema context
    const timestamp = new Date().getTime();
    const baseParams = segmentId ? `segmentId=${segmentId}` : '';
    const separator = baseParams ? '&' : '?';
    return this.makeRequest(`/table-metadata/${tableName}${baseParams ? '?' + baseParams : ''}${separator}_=${timestamp}`);
  }

  async getTableData(tableName: string, params?: {
    filterGroups?: any[],
    groupConditions?: string[],
    customSql?: string,
    page?: number,
    pageSize?: number,
    sortColumn?: string,
    sortOrder?: 'asc' | 'desc',
    segmentId?: string,
    countOnly?: boolean
  }) {
    // Add a cache-busting parameter for count-only requests to prevent browser caching
    const endpoint = params?.countOnly 
      ? `/table-data/${tableName}?countOnly=true&_=${Date.now()}` 
      : `/table-data/${tableName}`;
    
    return this.makeRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(params || {}),
    });
  }


  // Helper function to convert data to CSV format
  convertToCSV(data: any[], columns: string[]): string {
    // Create CSV header row
    const header = columns.join(',');
    
    // Create CSV data rows
    const rows = data.map(row => {
      return columns.map(col => {
        // Handle null or undefined values
        if (row[col] === null || row[col] === undefined) {
          return '';
        }
        
        const value = String(row[col]);
        
        // If value contains commas, quotes, or newlines, wrap in quotes and escape any quotes
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        
        return value;
      }).join(',');
    }).join('\n');
    
    // Combine header and rows
    return `${header}\n${rows}`;
  }
  
  // Export table data to CSV
  exportTableDataToCSV(data: any[], columns: string[], filename: string): void {
    // Convert data to CSV
    const csv = this.convertToCSV(data, columns);
    
    // Create a Blob with the CSV data
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    
    // Create a download link
    const link = document.createElement('a');
    
    // Create the URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Set link properties
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    // Add link to document, click it, and remove it
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async getTableDataWithSegment(tableName: string, segmentId: string, pagination?: {
    page: number,
    pageSize: number,
    sortColumn?: string,
    sortOrder?: 'asc' | 'desc'
  }) {
    try {
      // First get the segment to extract its filters
      const segmentResponse = await this.getSegmentById(segmentId, ["filter_groups", "filters"]);
      
      if (!segmentResponse || !segmentResponse.data) {
        throw new Error("Failed to load segment data");
      }
      
      const segment = segmentResponse.data;
      
      // Default pagination values
      const paginationParams = {
        page: pagination?.page || 1,
        pageSize: pagination?.pageSize || 10,
        sortColumn: pagination?.sortColumn,
        sortOrder: pagination?.sortOrder
      };
      
      // Check if we have custom SQL
      if (segment.custom_sql) {
        // Use custom SQL directly
        return this.makeRequest(`/table-data/${tableName}`, {
          method: "POST",
          body: JSON.stringify({
            customSql: segment.custom_sql,
            tableName: tableName,
            ...paginationParams
          }),
        });
      } 
      
      // Convert filter groups to the expected format
      const filterGroups = segment.filter_groups?.map(group => ({
        logic_operator: group.group_condition,
        filters: group.filters?.map(filter => ({
          type: 'condition',
          column: filter.column_name,
          operator: filter.filter_operator,
          value: filter.filter_operator === 'between' ? 
            [filter.filter_value, filter.filter_value_2] : 
            filter.filter_value,
          date_preset: filter.date_preset // Ensure date_preset is included
        }))
      })) || [];
      
      // Use the filters to get table data
      return this.makeRequest(`/table-data/${tableName}`, {
        method: "POST",
        body: JSON.stringify({ 
          filterGroups,
          groupConditions: segment.groupConditions || ['AND'],
          ...paginationParams
        }),
      });
    } catch (error) {
      console.error("Error in getTableDataWithSegment:", error);
      throw error;
    }
  }

  // Segments
  async getAllSegments(page = 1, limit = 10, status?: string): Promise<{ segments: SegmentData[]; pagination: any } | SegmentData[] | any> {
    let url = `/get-segments?page=${page}&limit=${limit}`
    if (status) {
      url += `&status=${status}`
    }
    return this.makeRequest(url)
  }

  async getDashboardSegments(): Promise<any> {
    // This endpoint should return only the fields needed for the dashboard
    return this.makeRequest('/get-segments-summary')
  }

  async getSegmentById(segmentId: string, include?: string[]): Promise<SegmentResponse> {
    let url = `/segments/${segmentId}`
    if (include && include.length > 0) {
      url += `?include=${include.join(",")}`
    }
    return this.makeRequest(url)
  }

  async createSegment(segmentData: {
    segment_name: string
    description?: string
    segment_config: {
      target_table: string
      conditions?: any[]
      start_date?: string
      end_date?: string
      start_time?: string
      end_time?: string
      [key: string]: any
    }
    is_template?: boolean
    is_saved_table?: boolean
    filter_groups?: Array<{
      group_name: string
      group_order: number
      group_condition: "AND" | "OR" | "NOT"
      description?: string
      filters: Array<{
        column_name: string
        column_data_type: string
        filter_operator: string
        filter_value: string
        filter_value_2?: string
        filter_order: number
        is_active?: boolean
        date_preset?: string  
      }>
    }>
    generated_sql?: string
    custom_sql?: string
    table_id?: string
    created_by?: string
    start_time?: string
    end_time?: string
    status?: string
  }) {
    // Get user info from localStorage for created_by if not provided
    if (!segmentData.created_by) {
      try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          segmentData.created_by = user.email || "unknown";
        }
      } catch (e) {
        console.error("Error getting user info:", e);
        segmentData.created_by = "unknown";
      }
    }

    // Extract table_id from segment_config if not provided
    if (!segmentData.table_id && segmentData.segment_config && segmentData.segment_config.target_table) {
      segmentData.table_id = segmentData.segment_config.target_table;
    }

    // Set default status if not provided
    if (!segmentData.status) {
      segmentData.status = "active";
    }

    // Format timing fields if present in segment_config
    if (segmentData.segment_config) {
      if (segmentData.segment_config.start_date && segmentData.segment_config.start_time) {
        segmentData.start_time = `${segmentData.segment_config.start_date} ${segmentData.segment_config.start_time}`;
      }
      if (segmentData.segment_config.end_date && segmentData.segment_config.end_time) {
        segmentData.end_time = `${segmentData.segment_config.end_date} ${segmentData.segment_config.end_time}`;
      }
    }

    // Ensure date_preset is passed for each filter
    if (segmentData.filter_groups) {
      segmentData.filter_groups.forEach((group: { filters?: any[] }) => {
        if (group.filters) {
          group.filters.forEach((filter: { 
            date_preset?: string | null; 
            filter_operator?: string;
          }) => {
            // Make sure date_preset is properly handled
            // If it's an empty string, set it to null
            if (filter.date_preset === '') {
              filter.date_preset = null;
            }
            
            // If filter_operator is a date preset operator, ensure date_preset is set
            if (filter.filter_operator && 
                ['lastYear', 'last6Months', 'last3Months', 'lastMonth', 'lastWeek', 
                 'thisYear', 'thisMonth', 'thisQuarter'].includes(filter.filter_operator)) {
              
              // Map legacy operator names to standardized preset names
              const operatorToPresetMap: Record<string, string> = {
                'lastYear': 'last_12_months',
                'last6Months': 'last_6_months',
                'last3Months': 'last_90_days',
                'lastMonth': 'last_30_days',
                'lastWeek': 'last_7_days',
                'thisYear': 'this_year',
                'thisMonth': 'this_month',
                'thisQuarter': 'this_quarter'
              };
              
              filter.date_preset = operatorToPresetMap[filter.filter_operator] || filter.date_preset;
              console.log(`Setting date_preset to ${filter.date_preset} for operator ${filter.filter_operator}`);
            }
          });
        }
      });
    }
    
    // console.log("Sending segment data to API:", segmentData);
    
    return this.makeRequest("/create-segment", {
      method: "POST",
      body: JSON.stringify(segmentData),
    })
  }

  async updateSegment(segmentId: string, segmentData: {
    segment_name?: string
    description?: string
    table_id?: string
    segment_config?: {
      target_table?: string
      start_date?: string
      end_date?: string
      start_time?: string
      end_time?: string
    }
    filter_groups?: Array<{
      group_name: string
      group_order: number
      group_condition: "AND" | "OR" | "NOT"
      description?: string
      filters: Array<{
        column_name: string
        column_data_type: string
        filter_operator: string
        filter_value: string
        filter_value_2?: string
        filter_order: number
        is_active?: boolean
        date_preset?: string  
      }>
    }>
    generated_sql?: string
    custom_sql?: string
    is_template?: boolean
    is_saved_table?: boolean
    status?: string
    start_time?: string
    end_time?: string
  }) {
    // console.log("Updating segment:", segmentId, segmentData);
    
    // Format timing fields if present in segment_config
    const formattedData: any = { ...segmentData };
    
    if (formattedData.segment_config) {
      if (formattedData.segment_config.start_date && formattedData.segment_config.start_time) {
        formattedData.start_time = `${formattedData.segment_config.start_date} ${formattedData.segment_config.start_time}`;
      }
      if (formattedData.segment_config.end_date && formattedData.segment_config.end_time) {
        formattedData.end_time = `${formattedData.segment_config.end_date} ${formattedData.segment_config.end_time}`;
      }
    }
    
    // Ensure date_preset is passed for each filter
    if (formattedData.filter_groups) {
      formattedData.filter_groups.forEach((group: { filters?: any[] }) => {
        if (group.filters) {
          group.filters.forEach((filter: { 
            date_preset?: string | null; 
            filter_operator?: string;
          }) => {
            // Make sure date_preset is properly handled
            // If it's an empty string, set it to null
            if (filter.date_preset === '') {
              filter.date_preset = null;
            }
            
            // If filter_operator is a date preset operator, ensure date_preset is set
            if (filter.filter_operator && 
                ['lastYear', 'last6Months', 'last3Months', 'lastMonth', 'lastWeek', 
                 'thisYear', 'thisMonth', 'thisQuarter'].includes(filter.filter_operator)) {
              
              // Map legacy operator names to standardized preset names
              const operatorToPresetMap: Record<string, string> = {
                'lastYear': 'last_12_months',
                'last6Months': 'last_6_months',
                'last3Months': 'last_90_days',
                'lastMonth': 'last_30_days',
                'lastWeek': 'last_7_days',
                'thisYear': 'this_year',
                'thisMonth': 'this_month',
                'thisQuarter': 'this_quarter'
              };
              
              filter.date_preset = operatorToPresetMap[filter.filter_operator] || filter.date_preset;
              console.log(`Setting date_preset to ${filter.date_preset} for operator ${filter.filter_operator}`);
            }
          });
        }
      });
    }
    
    return this.makeRequest(`/update-segment/${segmentId}`, {
      method: "PUT",
      body: JSON.stringify(formattedData),
    });
  }

  async deleteSegment(segmentId: string) {
    try {
      const response = await this.makeRequest(`/delete-segment/${segmentId}`, {
        method: "DELETE",
      })
      return response
    } catch (error: any) {
      // Check if the error is a permission error (403)
      if (error.message && error.message.includes("Permission denied")) {
        throw new Error("You don't have permission to delete this segment. Only the creator or an admin can delete segments.")
      }
      throw error
    }
  }

  async toggleSegmentStatus(segmentId: string, status: 'active' | 'disabled') {
    return this.makeRequest(`/toggle-segment-status/${segmentId}`, {
      method: "PUT",
      body: JSON.stringify({ status })
    })
  }

  async updateLastExecuted(segmentId: string) {
    return this.makeRequest(`/segments/${segmentId}/executed`, {
      method: "PUT",
    })
  }

  // User Management
  async getAllUsers() {
    return this.makeRequest("/get-users")
  }

  async addUser(userData: {
    email: string
    first_name: string
    last_name: string
    role: string
    is_active?: boolean
  }) {
    return this.makeRequest("/add-user", {
      method: "POST",
      body: JSON.stringify(userData),
    })
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    return this.makeRequest(`/users/${userId}/status`, {
      method: "PUT",
      body: JSON.stringify({ is_active: isActive }),
    })
  }

  async updateUserRole(userId: string, role: string) {
    return this.makeRequest(`/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    })
  }

  // Column visibility methods
  async getColumnVisibility(tableName: string): Promise<ColumnVisibilityResponse> {
    // Add a timestamp to prevent caching issues with schema context
    const timestamp = new Date().getTime();
    return this.makeRequest(`/admin/column-visibility/${tableName}?_=${timestamp}`)
  }

  async updateColumnVisibility(
    tableName: string, 
    configurations: Array<{ 
      column_name: string;
      is_visible: boolean;
    }>,
    updatedBy?: string
  ) {
    return this.makeRequest(`/admin/column-visibility/${tableName}`, {
      method: "PUT",
      body: JSON.stringify({ 
        configurations,
        updatedBy
      }),
    })
  }

  // Cache for unique column values
  private uniqueValuesCache: Record<string, {
    timestamp: number,
    data: any[],
    pagination: any
  }> = {};
  
  // Cache expiration time in milliseconds (5 minutes)
  private CACHE_EXPIRATION = 5 * 60 * 1000;

  async getUniqueColumnValues(
    tableName: string, 
    columnName: string, 
    params?: {
      page?: number, 
      limit?: number, 
      search?: string,
      segmentId?: string,
      skipCache?: boolean
    }
  ) {
    const page = params?.page || 1;
    const limit = params?.limit || 25;
    const search = params?.search || '';
    const segmentId = params?.segmentId || '';
    const skipCache = params?.skipCache || false;
    
    // Create a cache key based on the parameters
    const cacheKey = `${tableName}:${columnName}:${page}:${limit}:${search}:${segmentId}`;
    
    // Check if we have a valid cached response
    if (!skipCache && this.uniqueValuesCache[cacheKey]) {
      const cachedData = this.uniqueValuesCache[cacheKey];
      const now = Date.now();
      
      // If cache is still valid (less than 5 minutes old)
      if (now - cachedData.timestamp < this.CACHE_EXPIRATION) {
        console.log('Using cached unique values for:', cacheKey);
        return {
          success: true,
          data: cachedData.data,
          pagination: cachedData.pagination
        };
      } else {
        // Delete expired cache entry
        delete this.uniqueValuesCache[cacheKey];
      }
    }
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
      ...(segmentId && { segmentId })
    }).toString();
    
    // Make the API request with timeout
    try {
      // Create a timeout promise that rejects after 5 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out')), 5000);
      });
      
      // Race the actual request against the timeout
      const response = await Promise.race([
        this.makeRequest(`/table-data/${tableName}/column/${columnName}/unique-values?${queryParams}`),
        timeoutPromise
      ]) as any;
      
      // If the response is empty or has no data, return a consistent empty result
      if (!response || !response.data) {
        return {
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0
          }
        };
      }
      
      // Cache the response if successful
      if (response && response.success && response.data) {
        this.uniqueValuesCache[cacheKey] = {
          timestamp: Date.now(),
          data: response.data,
          pagination: response.pagination
        };
        
        // Clean up old cache entries if we have too many (keep only the 100 most recent)
        this.cleanCache();
      }
      
      return response;
    } catch (error: any) {
      console.error('Error fetching unique values:', error);
      
      // If there's a network or timeout error, try to use stale cache if available
      if (this.uniqueValuesCache[cacheKey]) {
        console.log('Using stale cache for:', cacheKey);
        const staleCache = this.uniqueValuesCache[cacheKey];
        return {
          success: true,
          data: staleCache.data,
          pagination: staleCache.pagination,
          fromStaleCache: true
        };
      }
      
      // Return a graceful empty result if all else fails
      return {
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        },
        error: error.message
      };
    }
  }

  // Clean up old cache entries to prevent memory leaks
  private cleanCache() {
    const cacheEntries = Object.entries(this.uniqueValuesCache);
    
    // If we have more than 100 cache entries, remove the oldest ones
    if (cacheEntries.length > 100) {
      // Sort by timestamp (oldest first)
      const sortedEntries = cacheEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove the oldest entries, keeping only the 100 most recent
      const entriesToRemove = sortedEntries.slice(0, sortedEntries.length - 100);
      
      for (const [key] of entriesToRemove) {
        delete this.uniqueValuesCache[key];
      }
    }
  }
}

export const dataService = new DataService()