const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
import { apiInterceptor } from "@/lib/api-interceptor"

interface User {
  user_id: string
  email: string
  first_name: string
  last_name: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

class AdminService {
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

    return data.data || data
  }

  async getAllUsers(): Promise<User[]> {
    return this.makeRequest("/get-users")
  }

  async addUser(userData: {
    email: string
    first_name: string
    last_name: string
    role: string
  }): Promise<User> {
    return this.makeRequest("/add-user", {
      method: "POST",
      body: JSON.stringify(userData),
    })
  }

  async updateUserStatus(userId: string, is_active: boolean) {
    return this.makeRequest(`/update-user-status/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ is_active }),
    })
  }

  async updateUserRole(userId: string, role: string) {
    return this.makeRequest(`/update-user-role/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    })
  }

  async getUserSessions(userId: string) {
    return this.makeRequest(`/users/${userId}/sessions`)
  }

  async getOtpStatus(email: string) {
    return this.makeRequest(`/admin/otp-status/${email}`)
  }
}

export const adminService = new AdminService()
