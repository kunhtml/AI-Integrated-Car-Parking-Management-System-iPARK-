"use client";

import * as React from "react";
import { addDays, format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  className?: string;
  date?: DateRange;
  onDateChange?: (date: DateRange | undefined) => void;
  align?: "center" | "start" | "end";
}

const presets = [
  { label: "Hôm nay", days: 0 },
  { label: "7 ngày", days: 7 },
  { label: "30 ngày", days: 30 },
  { label: "90 ngày", days: 90 },
];

export function DateRangePicker({
  className,
  date,
  onDateChange,
  align = "end",
}: DateRangePickerProps) {
  const [internalDate, setInternalDate] = React.useState<DateRange | undefined>(
    date ?? {
      from: addDays(new Date(), -7),
      to: new Date(),
    }
  );

  const currentDate = date ?? internalDate;

  const handleSelect = (range: DateRange | undefined) => {
    if (!date) setInternalDate(range);
    onDateChange?.(range);
  };

  const handlePreset = (days: number) => {
    const range: DateRange = {
      from: days === 0 ? new Date() : addDays(new Date(), -days),
      to: new Date(),
    };
    if (!date) setInternalDate(range);
    onDateChange?.(range);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-[260px] justify-start text-left font-normal",
              !currentDate && "text-muted-foreground"
            )}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            {currentDate?.from ? (
              currentDate.to ? (
                <>
                  {format(currentDate.from, "dd/MM/yyyy")} -{" "}
                  {format(currentDate.to, "dd/MM/yyyy")}
                </>
              ) : (
                format(currentDate.from, "dd/MM/yyyy")
              )
            ) : (
              <span>Chọn khoảng ngày</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <div className="flex">
            <div className="flex flex-col gap-1 border-r p-3">
              {presets.map((preset) => (
                <Button
                  key={preset.days}
                  variant="ghost"
                  size="sm"
                  className="justify-start text-xs"
                  onClick={() => handlePreset(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Calendar
              mode="range"
              defaultMonth={currentDate?.from}
              selected={currentDate}
              onSelect={handleSelect}
              numberOfMonths={2}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
