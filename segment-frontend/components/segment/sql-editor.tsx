"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Play, Copy, RotateCcw, Code } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface SqlEditorProps {
  sql: string
  onChange: (sql: string) => void
  onExecute: () => void
  onReset?: () => void
  isCustomActive?: boolean
  setIsCustomActive?: (active: boolean) => void
}

export function SqlEditor({ sql, onChange, onExecute, onReset, isCustomActive, setIsCustomActive }: SqlEditorProps) {
  const [originalSql, setOriginalSql] = useState(sql)
  const [isCustom, setIsCustom] = useState(isCustomActive !== undefined ? isCustomActive : (sql !== originalSql))
  const { toast } = useToast()

  // Update local isCustom state when prop changes
  useEffect(() => {
    if (isCustomActive !== undefined) {
      setIsCustom(isCustomActive)
    }
  }, [isCustomActive])

  // Update original SQL when the prop changes and we're not in custom mode
  useEffect(() => {
    if (!isCustom) {
      // When not in custom mode, always update the displayed SQL when it changes
      // This ensures filter changes are immediately reflected
      setOriginalSql(sql)
    } else {
      // If we're in custom mode, check if the SQL equals the original to potentially turn off custom mode
      if (sql === originalSql) {
        setIsCustom(false)
        if (setIsCustomActive) {
          setIsCustomActive(false)
        }
      }
    }
  }, [sql, isCustom, originalSql, setIsCustomActive])
  
  // Additional effect to detect custom SQL changes
  useEffect(() => {
    // When SQL is modified compared to original, make sure custom mode is on
    const isCurrentlyCustom = sql !== originalSql;
    if (isCurrentlyCustom !== isCustom) {
      setIsCustom(isCurrentlyCustom);
      if (setIsCustomActive) {
        setIsCustomActive(isCurrentlyCustom);
      }
    }
  }, [sql, originalSql, isCustom, setIsCustomActive]);

  const handleSqlChange = (newSql: string) => {
    onChange(newSql)
    
    // Update local and parent custom state
    setIsCustom(true)
    if (setIsCustomActive) {
      setIsCustomActive(true)
    }
  }

  const resetToGenerated = () => {
    if (onReset) {
      // Use the parent's reset function to ensure proper state sync
      onReset()
    } else {
      // Fallback to local reset
      onChange(originalSql)
    }
    
    // Update local and parent custom state
    setIsCustom(false)
    if (setIsCustomActive) {
      setIsCustomActive(false)
    }
    
    toast({
      title: "SQL Reset",
      description: "Reverted to auto-generated SQL from filters",
    })
  }

  // Watch for SQL changes from props and update textarea if not in custom mode
  useEffect(() => {
    if (!isCustom && sql !== originalSql) {
      setOriginalSql(sql)
    }
  }, [sql, isCustom])

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(sql)
      toast({
        title: "Copied",
        description: "SQL copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy SQL",
        variant: "destructive",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Code className="h-5 w-5 mr-2" />
            <span>SQL Editor</span>
            {isCustom && <Badge variant="secondary">Custom</Badge>}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={copySql}>
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            {isCustom && (
              <Button variant="outline" size="sm" onClick={resetToGenerated}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}
            <Button size="sm" onClick={onExecute}>
              <Play className="h-4 w-4 mr-1" />
              Execute
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Textarea
            value={sql}
            onChange={(e) => handleSqlChange(e.target.value)}
            className="font-mono text-sm min-h-32"
            placeholder="Enter your custom SQL query..."
          />
          <div className="text-xs text-muted-foreground">
            {isCustom
              ? "You're using custom SQL. Click 'Reset' to return to auto-generated SQL from filters."
              : "This SQL is auto-generated from your filter groups. Edit to customize."}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
