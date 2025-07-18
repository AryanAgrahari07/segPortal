const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
import { apiInterceptor } from "@/lib/api-interceptor"

export interface DeletionRequest {
  request_id: string;
  customer_email: string;
  status: 'pending' | 'completed' | 'failed' | 'rejected';
  notes?: string;
  customer_request_timestamp: string;
  entry_created_timestamp: string;
  processed_by_admin_email?: string;
  processed_at_timestamp?: string;
  deletion_sources: string;
}

export interface DeletionRequestInput {
  customer_email: string;
  customer_request_timestamp: string;
  notes?: string;
  deletion_sources?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
}

export type StatusFilter = 'all' | 'pending' | 'completed' | 'failed' | 'rejected';

class DataDeletionService {
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

    return data
  }

  async createDeletionRequest(requestData: DeletionRequestInput): Promise<DeletionRequest> {
    const response = await this.makeRequest("/data-deletion/requests", {
      method: "POST",
      body: JSON.stringify(requestData),
    })
    return response.data
  }

  async getAllDeletionRequests(
    page: number = 1, 
    limit: number = 10,
    status: StatusFilter = 'all'
  ): Promise<PaginatedResponse<DeletionRequest>> {
    const response = await this.makeRequest(`/data-deletion/requests?page=${page}&limit=${limit}&status=${status}`)
    return response
  }

  async getPendingDeletionRequests(): Promise<DeletionRequest[]> {
    const response = await this.makeRequest("/data-deletion/pending-requests")
    return response.data
  }

  async processDeletionRequest(requestId: string): Promise<DeletionRequest> {
    const response = await this.makeRequest(`/data-deletion/process/${requestId}`, {
      method: "POST"
    })
    return response.data
  }

  async processBulkDeletionRequests(requestIds: string[]): Promise<any> {
    const response = await this.makeRequest(`/data-deletion/process`, {
      method: "POST",
      body: JSON.stringify({ request_ids: requestIds })
    })
    return response
  }

  async rejectDeletionRequest(requestId: string, rejectionReason: string): Promise<DeletionRequest> {
    const response = await this.makeRequest(`/data-deletion/reject/${requestId}`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason: rejectionReason })
    })
    return response.data
  }

  async rejectBulkDeletionRequests(requestIds: string[], rejectionReason: string): Promise<any> {
    const response = await this.makeRequest(`/data-deletion/reject`, {
      method: "POST",
      body: JSON.stringify({ 
        request_ids: requestIds,
        rejection_reason: rejectionReason
      })
    })
    return response
  }
}

export const dataDeletionService = new DataDeletionService() 