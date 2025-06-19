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

// interface Segment {
//   segment_id: string
//   segment_name: string
//   description?: string
//   created_by: string
//   status: string
//   created_at: string
//   last_executed?: string
//   filter_groups?: FilterGroup[]
// }

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

  // Tables
  // async getAllTables() {
  //   return this.makeRequest("/tables")
  // }

  async getAllTables(): Promise<{ tables: table[] } | table[] | any> {
    return this.makeRequest("/tables")
  }

  async getTableMetadata(tableName: string): Promise<TableMetadata> {
    return this.makeRequest(`/table-metadata/${tableName}`)
  }

  async getTableData(tableName: string, params?: {
    filterGroups?: any[],
    groupConditions?: string[],
    customSql?: string,
    page?: number,
    pageSize?: number,
    sortColumn?: string,
    sortOrder?: 'asc' | 'desc'
  }) {
    return this.makeRequest(`/table-data/${tableName}`, {
      method: "POST",
      body: JSON.stringify(params || {}),
    })
  }

  /**
   * Get insights and statistics for table data
   * This function fetches analytical insights about the table data
   * It works with filters, custom SQL, and respects all the filtering options from getTableData
   */
  async getTableInsights(tableName: string, params?: {
    filterGroups?: any[],
    groupConditions?: string[],
    customSql?: string
  }) {
    return this.makeRequest(`/table-insights/${tableName}`, {
      method: "POST",
      body: JSON.stringify(params || {}),
    })
  }

  /**
   * Get insights and statistics for table data using a saved segment
   * This function fetches analytical insights about the table data based on a segment's filters or SQL
   */
  async getTableInsightsWithSegment(tableName: string, segmentId: string) {
    try {
      // First get the segment to extract its filters
      const segmentResponse = await this.getSegmentById(segmentId, ["filter_groups", "filters"]);
      
      if (!segmentResponse || !segmentResponse.data) {
        throw new Error("Failed to load segment data");
      }
      
      const segment = segmentResponse.data;
      
      // Check if we have custom SQL
      if (segment.custom_sql) {
        // Use custom SQL directly
        return this.makeRequest(`/table-insights/${tableName}`, {
          method: "POST",
          body: JSON.stringify({
            customSql: segment.custom_sql,
            tableName: tableName
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
            filter.filter_value
        }))
      }));
      
      // Extract group conditions if available
      const groupConditions = segment.segment_config?.groupConditions || 
                             segment.groupConditions || 
                             ['AND'];
                             
      // Make the request with the extracted filters
      return this.makeRequest(`/table-insights/${tableName}`, {
        method: "POST",
        body: JSON.stringify({
          filterGroups,
          groupConditions,
          tableName
        }),
      });
      
    } catch (error) {
      console.error("Error getting insights with segment:", error);
      throw error;
    }
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
            filter.filter_value
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
      segmentData.status = "pending";
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
    
    return this.makeRequest(`/update-segment/${segmentId}`, {
      method: "PUT",
      body: JSON.stringify(formattedData),
    });
  }

  async deleteSegment(segmentId: string) {
    return this.makeRequest(`/delete-segment/${segmentId}`, {
      method: "DELETE",
    })
  }

  async executeSegment(segmentId: string, options: { save_results: boolean }) {
    try {
      // console.log("Executing segment:", segmentId, options);
      return this.makeRequest(`/segments/${segmentId}/execute`, {
        method: "POST",
        body: JSON.stringify(options),
      });
    } catch (error) {
      console.error("Error executing segment:", error);
      throw error;
    }
  }

  async updateLastExecuted(segmentId: string) {
    return this.makeRequest(`/segments/${segmentId}/executed`, {
      method: "PUT",
    })
  }

  // Filter Groups
  async getFilterGroupsBySegmentId(segmentId: string): Promise<FilterGroup[]> {
    return this.makeRequest(`/segments/${segmentId}/filter-groups`)
  }

  async createFilterGroup(filterGroupData: {
    segment_id: string
    group_name: string
    group_order: number
    group_condition: "AND" | "OR"
    description?: string
  }) {
    return this.makeRequest(`/segments/${filterGroupData.segment_id}/filter-groups`, {
      method: "POST",
      body: JSON.stringify({
        group_name: filterGroupData.group_name,
        group_order: filterGroupData.group_order,
        group_condition: filterGroupData.group_condition,
        description: filterGroupData.description,
      }),
    })
  }

  async getFilterGroupById(groupId: string): Promise<FilterGroup> {
    return this.makeRequest(`/filter-groups/${groupId}`)
  }

  async updateFilterGroup(groupId: string, updates: Partial<Omit<FilterGroup, "id">>) {
    return this.makeRequest(`/filter-groups/${groupId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
  }

  async deleteFilterGroup(groupId: string) {
    return this.makeRequest(`/filter-groups/${groupId}`, {
      method: "DELETE",
    })
  }

  // Filters
  async getFiltersByGroupId(groupId: string): Promise<Filter[]> {
    return this.makeRequest(`/filter-groups/${groupId}/filters`)
  }

  async getFiltersBySegmentId(segmentId: string): Promise<Filter[]> {
    return this.makeRequest(`/segments/${segmentId}/filters`)
  }

  async createFilter(filterData: {
    filter_group_id: string
    column_name: string
    column_data_type: string
    filter_operator: string
    filter_value: string
    filter_value_2?: string
    filter_order: number
  }) {
    return this.makeRequest(`/filter-groups/${filterData.filter_group_id}/filters`, {
      method: "POST",
      body: JSON.stringify({
        column_name: filterData.column_name,
        column_data_type: filterData.column_data_type,
        filter_operator: filterData.filter_operator,
        filter_value: filterData.filter_value,
        filter_value_2: filterData.filter_value_2,
        filter_order: filterData.filter_order,
      }),
    })
  }

  async createFiltersBulk(groupId: string, filters: Array<Omit<Filter, "id" | "filter_group_id" | "is_active">>) {
    return this.makeRequest(`/filter-groups/${groupId}/filters/bulk`, {
      method: "POST",
      body: JSON.stringify({ filters }),
    })
  }

  async getFilterById(filterId: string): Promise<Filter> {
    return this.makeRequest(`/filters/${filterId}`)
  }

  async updateFilter(filterId: string, updates: Partial<Omit<Filter, "id" | "filter_group_id">>) {
    return this.makeRequest(`/filters/${filterId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
  }

  async deleteFilter(filterId: string) {
    return this.makeRequest(`/filters/${filterId}`, {
      method: "DELETE",
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
}

export const dataService = new DataService()