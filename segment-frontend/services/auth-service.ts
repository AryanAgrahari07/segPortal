const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
import { apiInterceptor } from "@/lib/api-interceptor"

class AuthService {
  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`

    // Use the interceptor to handle 401 responses
    const response = await apiInterceptor.fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || "Request failed")
    }

    return  data
  }

  async sendOTP(email: string) {
    return this.makeRequest("/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    })
  }

  async verifyOTP(email: string, otp: string) {
    return this.makeRequest("/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, OTP: otp }),
    })
  }

  async refreshToken() {
    return this.makeRequest("/refresh-token", {
      method: "POST",
      credentials: "include",
    })
  }

  async checkToken(token: string) {
    return this.makeRequest("/check", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  getTokenExpirationTime(token: string): number {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp;
    } catch {
      return 0;
    }
  }

  isTokenExpired(token: string): boolean {
    try {
      const expirationTime = this.getTokenExpirationTime(token);
      const currentTime = Math.floor(Date.now() / 1000);
      return currentTime >= expirationTime;
    } catch {
      return true;
    }
  }

  needsRefresh(token: string, bufferTime: number = 20): boolean {
    try {
      const expirationTime = this.getTokenExpirationTime(token);
      const currentTime = Math.floor(Date.now() / 1000);
      return expirationTime - currentTime <= bufferTime;
    } catch {
      return true;
    }
  }
  
  // Set cookies for authentication
  setCookies(token: string, role: string) {
    document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60 }; SameSite=Lax`;
    document.cookie = `userRole=${role}; path=/; max-age=${7 * 24 * 60 * 60 }; SameSite=Lax`;
  }
  
  // Clear cookies
  clearCookies() {
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  }
}

export const authService = new AuthService()
