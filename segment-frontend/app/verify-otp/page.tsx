"use client"
// \
// "@/

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, KeyRound, ArrowRight, RefreshCw, Clock } from "lucide-react"
import { authService } from "@/services/auth-service"
import { useAuth } from "@/contexts/auth-context"

export default function VerifyOTPPage() {
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [timeLeft, setTimeLeft] = useState(60) // 60 seconds
  const [resendDisabled, setResendDisabled] = useState(true)
  const [resendLoading, setResendLoading] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { login } = useAuth()

  useEffect(() => {
    const emailParam = searchParams?.get("email")
    if (!emailParam) {
      router.push("/login")
      return
    }
    setEmail(emailParam)
    
    // Enable resend after 30 seconds
    const resendTimer = setTimeout(() => {
      setResendDisabled(false)
    }, 30000)
    
    return () => clearTimeout(resendTimer)
  }, [searchParams, router])

  // OTP timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)
    
    return () => clearInterval(timer)
  }, [timeLeft])
  
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
      setTimeLeft(300)
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
      
      if(userRole === "admin") {
        // Redirect to dashboard
        router.push("/admin")
      } else {
        // Redirect to table page
        router.push("/dashboard")
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.15),transparent_40%)] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(59,130,246,0.1),transparent_30%)] pointer-events-none"></div>
      
      <Card className="w-full max-w-md border border-slate-800/50 shadow-xl bg-slate-900/70 backdrop-blur-xl">
        <CardHeader className="space-y-1 pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center text-white">Verify OTP</CardTitle>
          <CardDescription className="text-slate-400 text-center">
            Enter the verification code sent to {email}
          </CardDescription>
          
          <div className="mt-4 flex items-center justify-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <div className={`text-sm font-medium ${timeLeft <= 60 ? 'text-red-400' : 'text-blue-400'}`}>
              Code expires in {formatTime(timeLeft)}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-slate-300 font-medium">
                Verification Code
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent h-12 tracking-wider text-lg"
                  required
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 mt-2" 
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
              className={`text-sm flex items-center gap-1.5 mx-auto ${resendDisabled ? 'text-slate-500' : 'text-blue-400 hover:text-blue-300'}`}
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
        
        <CardFooter className="flex justify-center border-t border-slate-800 pt-4 pb-6">
          <p className="text-sm text-slate-400">
            Secure authentication powered by OTP verification
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
