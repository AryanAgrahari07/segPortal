"use client"
// \
// "@/

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, KeyRound, ArrowRight, RefreshCw, Clock } from "lucide-react"
import { authService } from "@/services/auth-service"
import { useAuth } from "@/contexts/auth-context"
import Image from "next/image"

// Utility functions for timer persistence
const getStoredTimerData = (email: string) => {
  try {
    const storedData = localStorage.getItem(`otp_timer_${email}`);
    if (storedData) {
      const { expiryTime } = JSON.parse(storedData);
      const now = new Date().getTime();
      const remainingTime = Math.max(0, Math.floor((expiryTime - now) / 1000));
      return remainingTime > 0 ? remainingTime : 0;
    }
  } catch (error) {
    console.error("Error retrieving stored timer data:", error);
  }
  return 60; // Default to 60 seconds if no stored data
};

const storeTimerData = (email: string, seconds: number) => {
  try {
    const now = new Date().getTime();
    const expiryTime = now + (seconds * 1000);
    localStorage.setItem(`otp_timer_${email}`, JSON.stringify({
      expiryTime,
      startTime: now
    }));
  } catch (error) {
    console.error("Error storing timer data:", error);
  }
};

export default function VerifyOTPPage() {
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [timeLeft, setTimeLeft] = useState(60) // Default value, will be updated
  const [resendDisabled, setResendDisabled] = useState(true)
  const [resendLoading, setResendLoading] = useState(false)
  const timerInitialized = useRef(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { login, user } = useAuth()

  useEffect(() => {
    // Check if user is already logged in
    if (user) {
      // Redirect to appropriate page based on user role
      if (user.role === "admin") {
        router.push("/admin")
      } else {
        router.push("/dashboard")
      }
      return
    }

    const emailParam = searchParams?.get("email")
    if (!emailParam) {
      router.push("/login")
      return
    }
    
    setEmail(emailParam)
    
    // Only initialize the timer once
    if (!timerInitialized.current) {
      // Get stored timer value or default to 60 seconds
      const storedTimeLeft = getStoredTimerData(emailParam);
      setTimeLeft(storedTimeLeft);
      
      // If timer is already low, enable resend button
      if (storedTimeLeft < 30) {
        setResendDisabled(false);
      } else {
        // Schedule enabling the resend button
        const timeToEnable = (storedTimeLeft - 30) * 1000; // Convert to milliseconds
        const resendTimer = setTimeout(() => {
          setResendDisabled(false)
        }, Math.max(0, timeToEnable));
        
        return () => clearTimeout(resendTimer);
      }
      
      timerInitialized.current = true;
    }
  }, [searchParams, router, user])

  // OTP timer countdown with persistence
  useEffect(() => {
    if (!email || timeLeft <= 0) return;
    
    // Store initial timer state
    storeTimerData(email, timeLeft);
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const newValue = prev - 1;
        if (newValue <= 0) {
          clearInterval(timer);
          return 0;
        }
        // Update stored timer on each tick
        storeTimerData(email, newValue);
        return newValue;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, email]);
  
  // Format time as MM:SS
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  const handleResendOTP = async () => {
    if (resendDisabled) return
    
    setResendLoading(true)
    try {
      await authService.sendOTP(email)
      
      toast({
        title: "OTP Resent",
        description: "A new verification code has been sent to your email",
      })
      
      // Reset timer and disable resend button
      setTimeLeft(60)
      storeTimerData(email, 60); // Store the new timer value
      setResendDisabled(true)
      setTimeout(() => setResendDisabled(false), 30000)
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resend OTP",
        variant: "destructive",
      })
    } finally {
      setResendLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!otp) {
      toast({
        title: "Error",
        description: "Please enter the verification code",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await authService.verifyOTP(email, otp)
      
      toast({
        title: "Success",
        description: "You have been successfully logged in",
      })
      
      // Check if token exists in the response
      if (!response.token) {
        throw new Error("Authentication token not received");
      }
      
      // Extract user data and token
      const userData = response.data || response;
      const token = response.token;
      
      // Set cookies for middleware
      const userRole = userData.role || 'user';
      authService.setCookies(token, userRole);
      
      // Call login function with the extracted data
      login(response, token);
      
      // Clear the stored timer data on successful login
      localStorage.removeItem(`otp_timer_${email}`);
      
      if(userRole === "admin") {
        // Redirect to dashboard
        router.push("/admin")
        // Replace current history entry to prevent going back to OTP page
        router.replace("/admin")
      } else {
        // Redirect to table page
        router.push("/dashboard")
        // Replace current history entry to prevent going back to OTP page
        router.replace("/dashboard")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Invalid verification code",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-950 via-indigo-950 to-purple-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(147,112,219,0.18),transparent_40%)] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(79,70,229,0.15),transparent_30%)] pointer-events-none"></div>
      <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none"></div>
      
      <Card className="w-full max-w-md border border-indigo-800/40 shadow-2xl bg-slate-900/80 backdrop-blur-xl">
        <CardHeader className="space-y-1 pb-6">
          <div className="flex justify-center mb-6">
            <Image 
              src="/logo.jpg" 
              alt="Logo" 
              width={120} 
              height={120} 
              className="h-28 w-auto object-contain rounded-lg shadow-lg shadow-indigo-500/20"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center text-white">Verify OTP</CardTitle>
          <CardDescription className="text-indigo-200 text-center">
            Enter the verification code sent to {email}
          </CardDescription>
          
          <div className="mt-4 flex items-center justify-center gap-2">
            <Clock className="h-4 w-4 text-indigo-300" />
            <div className={`text-sm font-medium ${timeLeft <= 10 ? 'text-red-400' : 'text-indigo-300'}`}>
              Code expires in {formatTime(timeLeft)}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-indigo-200 font-medium">
                Verification Code
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-5 w-5 text-indigo-300" />
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="pl-10 bg-slate-800/60 border-indigo-600/50 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-12 tracking-wider text-lg"
                  required
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 mt-2 shadow-lg shadow-indigo-900/30" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Verify & Login</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResendOTP}
              disabled={resendDisabled || resendLoading}
              className={`text-sm flex items-center gap-1.5 mx-auto ${resendDisabled ? 'text-slate-500' : 'text-indigo-400 hover:text-indigo-300'}`}
            >
              {resendLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {resendDisabled ? 'Resend available soon' : 'Resend verification code'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
