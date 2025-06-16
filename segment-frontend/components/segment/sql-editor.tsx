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
}

export function SqlEditor({ sql, onChange, onExecute, onReset }: SqlEditorProps) {
  const [isCustom, setIsCustom] = useState(false)
  const [originalSql, setOriginalSql] = useState(sql)
  const { toast } = useToast()

  // Update original SQL when the prop changes and we're not in custom mode
  useEffect(() => {
    if (!isCustom) {
      setOriginalSql(sql)
    }
  }, [sql, isCustom])

  const handleSqlChange = (newSql: string) => {
    onChange(newSql)
    setIsCustom(true)
  }

  const resetToGenerated = () => {
    if (onReset) {
      onReset()
    } else {
      onChange(originalSql)
    }
    setIsCustom(false)
    toast({
      title: "SQL Reset",
      description: "Reverted to auto-generated SQL from filters",
    })
  }

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
