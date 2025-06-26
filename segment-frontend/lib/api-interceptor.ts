"use client"

import { toast } from "@/hooks/use-toast"

// Flag to prevent multiple auth error handling
let isHandlingAuthError = false;

export const apiInterceptor = {
  // Handle unauthorized responses (401)
  handleUnauthorized: () => {
    // Prevent multiple auth error handling
    if (isHandlingAuthError) {
      return;
    }
    
    isHandlingAuthError = true;
    
    // Clear auth data
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    
    // Clear cookies
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    
    // Show toast notification
    toast({
      title: "Session Expired",
      description: "Your session has expired. Please log in again.",
      variant: "destructive",
    });
    
    // Redirect to login page after a short delay
    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
  },
  
  // Wrap fetch requests to handle auth errors
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, options);
    
    // Handle unauthorized responses
    if (response.status === 401) {
      this.handleUnauthorized();
    }
    
    return response;
  }
} 