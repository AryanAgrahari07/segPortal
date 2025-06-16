"use client"
// \
// "@/

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, KeyRound } from "lucide-react"
import { authService } from "@/services/auth-service"
import { useAuth } from "@/contexts/auth-context"

export default function VerifyOTPPage() {
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
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
  }, [searchParams, router])

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
      console.log("OTP verification response:", response);
      
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
      
      console.log("Token:", token);
      console.log("User data:", userData);
      
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
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass-effect border-white/20">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white">Verify OTP</CardTitle>
          <CardDescription className="text-white/80">
            Enter the verification code sent to {email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-white">
                Verification Code
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-white/60" />
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter verification code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-white text-purple-600 hover:bg-white/90" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Login"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
