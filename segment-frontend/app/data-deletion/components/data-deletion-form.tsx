"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { CalendarIcon, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { dataDeletionService } from "@/services/data-deletion-service"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const formSchema = z.object({
  customer_email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  customer_request_date: z.date({
    required_error: "Please select a date.",
  }),
  customer_request_hour: z.string(),
  customer_request_minute: z.string(),
  customer_request_period: z.enum(["AM", "PM"]),
  notes: z.string().optional(),
  shopify: z.boolean().default(false),
  braze: z.boolean().default(false),
  cdr: z.boolean().default(false),
})

type FormValues = z.infer<typeof formSchema>

export default function DataDeletionForm() {
  const { toast } = useToast()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get current time for default values
  const now = new Date()
  const currentHour = format(now, "h") // 12-hour format
  const currentMinute = format(now, "mm")
  const currentPeriod = format(now, "a").toUpperCase() as "AM" | "PM"

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_email: "",
      notes: "",
      customer_request_hour: currentHour,
      customer_request_minute: currentMinute,
      customer_request_period: currentPeriod,
      customer_request_date: now,
      shopify: false,
      braze: false,
      cdr: false,
    },
  })

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true)
      
      // Convert 12-hour format to 24-hour format
      let hour = parseInt(data.customer_request_hour)
      if (data.customer_request_period === "PM" && hour < 12) {
        hour += 12
      } else if (data.customer_request_period === "AM" && hour === 12) {
        hour = 0
      }
      
      // Format time
      const timeStr = `${hour.toString().padStart(2, '0')}:${data.customer_request_minute}`
      
      // Combine date and time into a single timestamp
      const dateStr = format(data.customer_request_date, "yyyy-MM-dd")
      const timestamp = `${dateStr}T${timeStr}:00.000Z`
      
      // Create comma-separated list of selected sources
      const selectedSources: string[] = []
      if (data.shopify) selectedSources.push('Shopify')
      if (data.braze) selectedSources.push('Braze')
      if (data.cdr) selectedSources.push('CDR')
      const deletionSources = selectedSources.join(',')
      
      await dataDeletionService.createDeletionRequest({
        customer_email: data.customer_email,
        customer_request_timestamp: timestamp,
        notes: data.notes,
        deletion_sources: deletionSources,
      })
      
      toast({
        title: "Request submitted",
        description: "The data deletion request has been created successfully.",
      })
      
      // Reset form
      form.reset({
        customer_email: "",
        customer_request_hour: currentHour,
        customer_request_minute: currentMinute,
        customer_request_period: currentPeriod,
        customer_request_date: now,
        notes: "",
        shopify: false,
        braze: false,
        cdr: false,
      })
    } catch (error) {
      console.error("Error submitting deletion request:", error)
      toast({
        title: "Error",
        description: "Failed to submit data deletion request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="customer_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Email</FormLabel>
              <FormControl>
                <Input 
                  placeholder="customer@example.com" 
                  {...field} 
                  className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30"
                />
              </FormControl>
              <FormDescription>
                This is the email address of the customer requesting data deletion.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="customer_request_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Request Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  The date when the customer sent the deletion request email.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div>
            <FormLabel>Request Time</FormLabel>
            <div className="flex items-center gap-2 mt-2">
              <FormField
                control={form.control}
                name="customer_request_hour"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30">
                          <SelectValue placeholder="Hour" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                          <SelectItem key={hour} value={hour.toString()}>
                            {hour}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <span>:</span>
              <FormField
                control={form.control}
                name="customer_request_minute"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30">
                          <SelectValue placeholder="Minute" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                          <SelectItem key={minute} value={minute.toString().padStart(2, '0')}>
                            {minute.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customer_request_period"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="PM">PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <Clock className="h-4 w-4 opacity-50" />
            </div>
            <FormDescription className="mt-1">
              The time when the customer sent the request.
            </FormDescription>
          </div>
        </div>
        
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Add any relevant notes about this request..."
                  className="resize-none border-violet-300 dark:border-violet-700 focus-visible:ring-violet-500/30"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Optional notes about the request (e.g., "User mentioned GDPR in their email").
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="space-y-4">
          <div className="font-medium text-sm">Select data sources to delete from:</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="shopify"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-violet-300 dark:border-violet-700 p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-500/30"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Shopify</FormLabel>
                    <FormDescription>
                      Delete customer data from Shopify
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="braze"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-violet-300 dark:border-violet-700 p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-500/30"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Braze</FormLabel>
                    <FormDescription>
                      Delete customer data from Braze
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="cdr"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-violet-300 dark:border-violet-700 p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-500/30"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>CDR</FormLabel>
                    <FormDescription>
                      Delete customer data from CDR
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white"
        >
          {isSubmitting ? "Submitting..." : "Submit Request"}
        </Button>
      </form>
    </Form>
  )
} 