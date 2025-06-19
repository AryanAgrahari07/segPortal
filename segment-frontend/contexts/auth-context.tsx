"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { authService } from "@/services/auth-service"
import { apiInterceptor } from "@/lib/api-interceptor"
import { toast } from "@/hooks/use-toast"

interface User {
  email: string
  first_name: string
  last_name: string
  role: string
}

interface ApiResponse {
  success?: boolean
  token?: string
  data?: User
  cookieSet?: boolean
  [key: string]: any
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (userData: User | ApiResponse, token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Constants for token refresh
const REFRESH_BUFFER_TIME = 25; // seconds before expiry to refresh
const CHECK_INTERVAL = 10; // check every 10 seconds

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session on mount
    checkAuthStatus()
  }, [])

  // Token refresh logic
  useEffect(() => {
    if (!token) return;

    // Main token check and refresh logic
    const checkAndRefreshToken = async () => {
      try {
        // console.log("Checking token:", token)
        // console.log("Token expired:", authService.isTokenExpired(token))
        // console.log("Token needs refresh:", authService.needsRefresh(token, REFRESH_BUFFER_TIME))

        // If access token is completely expired
        if (authService.isTokenExpired(token)) {
          // console.log("Access token expired, attempting refresh");
          const refreshed = await refreshToken();
          if (!refreshed) {
            handleSessionExpired("Your session has expired");
            return;
          }
          return;
        }

        // If access token needs proactive refresh
        if (authService.needsRefresh(token, REFRESH_BUFFER_TIME)) {
          // console.log("Access token near expiry, refreshing proactively");
          await refreshToken();
        }
      } catch (error) {
        console.error("Error checking token:", error);
      }
    };

    // Initial check
    checkAndRefreshToken();

    // Set up interval to check token periodically
    const intervalId = setInterval(checkAndRefreshToken, CHECK_INTERVAL * 1000);

    return () => clearInterval(intervalId);
  }, [token]);

  const checkAuthStatus = async () => {
    try {
      const storedToken = localStorage.getItem("token")
      const storedUser = localStorage.getItem("user")

      if (storedToken && storedUser) {
        // Verify token validity before setting it
        if (authService.isTokenExpired(storedToken)) {
          // Try to refresh the token
          const refreshed = await refreshToken();
          if (!refreshed) {
            // Clear invalid stored data
            localStorage.removeItem("token")
            localStorage.removeItem("user")
            authService.clearCookies();
            return;
          }
        } else {
          const userData = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(userData);
          // Set cookies for middleware
          authService.setCookies(storedToken, userData.role || 'user');
        }
      }
    } catch (error) {
      // Clear any invalid stored data
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      authService.clearCookies();
    } finally {
      setLoading(false)
    }
  }

  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await authService.refreshToken();
      
      if (response && response.token) {
        setToken(response.token);
        localStorage.setItem("token", response.token);
        
        // Get user role from current user state
        if (user && user.role) {
          // Set cookies with the refreshed token and existing role
          authService.setCookies(response.token, user.role);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error("Token refresh failed:", error);
      return false;
    }
  }

  // Handle session expired
  const handleSessionExpired = (message: string = "Session expired") => {
    // Clear user data
    logout();
    
    // Show toast notification
    toast({
      title: "Session Expired",
      description: message,
      variant: "destructive",
    });
  }

  const login = (userData: User | ApiResponse, userToken: string) => {
    // Handle potential nested data structure
    const user = (userData as ApiResponse).data ? (userData as ApiResponse).data : userData as User;
    
    if (user) {
      setUser(user)
      setToken(userToken)
      localStorage.setItem("token", userToken)
      localStorage.setItem("user", JSON.stringify(user))
      
      // Set cookies for middleware with user role
      authService.setCookies(userToken, user.role || 'user');
      
      // console.log("Auth context - Token saved:", userToken)
      // console.log("Auth context - User saved:", user)
    } else {
      console.error("Invalid user data received", userData)
      console.error("Failed to process login data")
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    // Clear cookies
    authService.clearCookies();
    window.location.href = "/login"
  }

  return <AuthContext.Provider value={{ user, token, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
