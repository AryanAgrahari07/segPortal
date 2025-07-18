import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  DatePreset, 
  DATE_PRESET_OPTIONS, 
  calculateDateRangeFromPreset, 
  formatDate,
  getDateRangeDisplayText
} from "@/lib/date-utils";
import { Badge } from "../ui/badge";
import { Clock } from "lucide-react";

interface DateFilterControlsProps {
  filter: {
    column_name: string;
    column_data_type: string;
    filter_operator: string;
    filter_value: string;
    filter_value_2?: string;
    date_preset?: string | null;
    [key: string]: any;
  };
  onUpdate: (filter: any) => void;
}

export function DateFilterControls({ filter, onUpdate }: DateFilterControlsProps) {
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>(
    (filter.date_preset as DatePreset) || null
  );
  
  // When preset changes, update the filter values
  useEffect(() => {
    if (selectedPreset && selectedPreset !== 'custom') {
      // Calculate dates based on preset
      const { startDate, endDate } = calculateDateRangeFromPreset(selectedPreset);
      
      // Update filter values but don't trigger onUpdate to avoid infinite loop
      if (startDate && endDate) {
        filter.filter_value = formatDate(startDate);
        filter.filter_value_2 = formatDate(endDate);
      }
    }
  }, [selectedPreset]);
  
  // Handle preset change
  const handlePresetChange = (preset: string) => {
    const newPreset = preset === 'custom' ? null : preset as DatePreset;
    setSelectedPreset(newPreset);
    
    if (preset !== 'custom') {
      // Calculate dates based on preset
      const { startDate, endDate } = calculateDateRangeFromPreset(newPreset);
      
      // Update filter with preset and calculated dates
      onUpdate({
        ...filter,
        date_preset: newPreset, // This is the standardized format (e.g., "last_6_months")
        filter_operator: 'between',
        filter_value: startDate ? formatDate(startDate) : filter.filter_value,
        filter_value_2: endDate ? formatDate(endDate) : filter.filter_value_2
      });
      
      // Log for debugging
      console.log(`Setting date_preset to: ${newPreset}`);
    } else {
      // For custom, explicitly set date_preset to null (not empty string)
      onUpdate({
        ...filter,
        date_preset: null
      });
      
      console.log('Setting date_preset to null for custom dates');
    }
  };
  
  // Handle date input changes for custom dates
  const handleDateChange = (field: 'filter_value' | 'filter_value_2', value: string) => {
    // When manually changing dates, ensure we're in custom mode
    onUpdate({
      ...filter,
      [field]: value,
      date_preset: null // Explicitly set to null when using custom dates
    });
  };
  
  return (
    <div className="space-y-4">
      <div>
        <Label>Date Range Preset</Label>
        <Select 
          value={selectedPreset || 'custom'} 
          onValueChange={handlePresetChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a preset" />
          </SelectTrigger>
          <SelectContent>
            {DATE_PRESET_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {selectedPreset && selectedPreset !== 'custom' && (
          <div className="mt-2 flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            <span>Dynamic: {getDateRangeDisplayText(selectedPreset)}</span>
            <Badge variant="outline" className="ml-2 text-xs bg-violet-100 dark:bg-violet-900/30">
              Updates automatically
            </Badge>
          </div>
        )}
      </div>
      
      {(!selectedPreset || selectedPreset === 'custom') ? (
        // Show custom date inputs only for custom preset
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={filter.filter_value || ''}
              onChange={(e) => handleDateChange('filter_value', e.target.value)}
            />
          </div>
          <div>
            <Label>End Date</Label>
            <Input
              type="date"
              value={filter.filter_value_2 || ''}
              onChange={(e) => handleDateChange('filter_value_2', e.target.value)}
            />
          </div>
        </div>
      ) : (
        // For presets, show the calculated dates as disabled inputs
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Start Date (Auto-calculated)</Label>
            <Input
              type="date"
              value={filter.filter_value || ''}
              disabled
              className="bg-muted"
            />
          </div>
          <div>
            <Label>End Date (Auto-calculated)</Label>
            <Input
              type="date"
              value={filter.filter_value_2 || ''}
              disabled
              className="bg-muted"
            />
          </div>
        </div>
      )}
    </div>
  );
} 