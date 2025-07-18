"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Mail, LockKeyhole, ArrowRight } from "lucide-react"
import { authService } from "@/services/auth-service"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      await authService.sendOTP(email)

      toast({
        title: "OTP Sent",
        description: "Please check your email for the verification code",
      })
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP",
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
          <div className="flex justify-center mb-8">
          <Image 
              src="/logo.jpg" 
              alt="Logo" 
              width={120} 
              height={120} 
              className="h-28 w-auto object-contain rounded-lg shadow-lg shadow-indigo-500/20"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center text-white">Welcome Back</CardTitle>
          <CardDescription className="text-indigo-200 text-center">
            Enter your email to receive a secure verification code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendOTP} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-indigo-200 font-medium">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-indigo-300" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-800/60 border-indigo-600/50 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-12"
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
                  <span>Sending OTP...</span>
                </>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
        
      </Card>
    </div>
  )
}
