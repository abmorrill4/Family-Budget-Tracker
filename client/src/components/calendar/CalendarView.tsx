import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { TypeBadge } from "@/components/ui/TypeBadge";
import { TransactionForm } from "@/components/ledger/TransactionForm";
import { fetchCalendar, fetchTransactionsByDate } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { buildCalendarGrid, formatCurrency, cn } from "@/lib/utils";
import type { DayMetrics, ProjectedOccurrence, Transaction } from "@/types";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MonthNavigator() {
  const { calendarYear, calendarMonth, setCalendarDate } = useAppStore();

  const goToPrev = () => {
    if (calendarMonth === 1) {
      setCalendarDate(calendarYear - 1, 12);
    } else {
      setCalendarDate(calendarYear, calendarMonth - 1);
    }
  };

  const goToNext = () => {
    if (calendarMonth === 12) {
      setCalendarDate(calendarYear + 1, 1);
    } else {
      setCalendarDate(calendarYear, calendarMonth + 1);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCalendarDate(now.getFullYear(), now.getMonth() + 1);
  };

  const years = Array.from({ length: 21 }, (_, i) => calendarYear - 10 + i);

  return (
    <div className="flex items-center gap-3 mb-4">
      <Button variant="outline" size="icon" onClick={goToPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={goToNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={goToToday}>
        Today
      </Button>

      <Select
        value={String(calendarMonth)}
        onValueChange={(v) => setCalendarDate(calendarYear, parseInt(v, 10))}
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_NAMES.map((name, i) => (
            <SelectItem key={i} value={String(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(calendarYear)}
        onValueChange={(v) => setCalendarDate(parseInt(v, 10), calendarMonth)}
      >
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DayCell({
  day,
  metrics,
  isToday,
  onClick,
  projectedItems,
}: {
  day: number;
  metrics: DayMetrics | undefined;
  isToday: boolean;
  onClick: () => void;
  projectedItems: ProjectedOccurrence[];
}) {
  const hasNegativeEnding = metrics && metrics.ending < 0;

  return (
    <div
      className={cn(
        "border rounded-md p-1.5 min-h-[100px] cursor-pointer transition-colors hover:bg-muted/50",
        hasNegativeEnding && "bg-red-50"
      )}
      onClick={onClick}
    >
      <div className="mb-1">
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center text-xs font-medium",
            isToday && "bg-primary text-primary-foreground rounded-full"
          )}
        >
          {day}
        </span>
      </div>
      {metrics?.hasActivity && (
        <div className="space-y-0.5 text-[11px] leading-tight">
          <div className="flex justify-between">
            <span className="text-muted-foreground">S:</span>
            <span className="text-muted-foreground font-mono">
              {formatCurrencyShort(metrics.starting)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-red-600 font-semibold">O:</span>
            <span className="text-red-600 font-semibold font-mono">
              {formatCurrencyShort(metrics.outflows)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-emerald-600 font-semibold">I:</span>
            <span className="text-emerald-600 font-semibold font-mono">
              {formatCurrencyShort(metrics.inflows)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary font-bold">E:</span>
            <span className="text-primary font-bold font-mono">
              {formatCurrencyShort(metrics.ending)}
            </span>
          </div>
        </div>
      )}
      {projectedItems.map((p) => (
        <div
          key={p.ruleId}
          className="text-xs text-muted-foreground border border-dashed rounded px-1 mt-1 truncate"
          title={`${p.ruleName}: ${p.amount < 0 ? "-" : "+"}$${Math.abs(p.amount).toFixed(2)}`}
        >
          {p.ruleName}: {p.amount < 0 ? "-" : "+"}${Math.abs(p.amount).toFixed(0)}
        </div>
      ))}
    </div>
  );
}

function formatCurrencyShort(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function DaySheet({
  date,
  onClose,
}: {
  date: string;
  onClose: () => void;
}) {
  const { openForm } = useAppStore();

  const { data } = useQuery({
    queryKey: ["transactions", "day", date],
    queryFn: () => fetchTransactionsByDate(date),
    enabled: !!date,
  });

  const transactions = data?.data ?? [];

  // Group by type
  const grouped = transactions.reduce(
    (acc, txn) => {
      if (!acc[txn.type]) acc[txn.type] = [];
      acc[txn.type]!.push(txn);
      return acc;
    },
    {} as Record<string, Transaction[]>
  );

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Sheet open={!!date} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{formattedDate}</SheetTitle>
          <SheetDescription>
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} on this day
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => openForm(null, date)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add transaction for this day
          </Button>

          {Object.entries(grouped).map(([type, txns]) => (
            <div key={type}>
              <div className="mb-2">
                <TypeBadge type={type as Transaction["type"]} />
              </div>
              <div className="space-y-2">
                {txns.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{txn.name}</p>
                      {txn.notes && (
                        <p className="text-xs text-muted-foreground">{txn.notes}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-mono font-medium",
                        txn.amount >= 0 ? "text-emerald-600" : "text-red-600"
                      )}
                    >
                      {formatCurrency(txn.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {transactions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No transactions on this day.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function CalendarView() {
  const { calendarYear, calendarMonth, selectedDay, setSelectedDay } =
    useAppStore();

  const [showProjected, setShowProjected] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", calendarYear, calendarMonth],
    queryFn: () => fetchCalendar(calendarYear, calendarMonth),
  });

  const grid = buildCalendarGrid(calendarYear, calendarMonth);
  const metricsMap = new Map<number, DayMetrics>();

  if (data) {
    for (const day of data.days) {
      const d = parseInt(day.date.slice(-2), 10);
      metricsMap.set(d, day);
    }
  }

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === calendarYear && today.getMonth() + 1 === calendarMonth;
  const todayDate = today.getDate();

  const handleDayClick = (day: number) => {
    const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSelectedDay(dateStr);
  };

  return (
    <div>
      <MonthNavigator />
      <div className="mb-4">
        <Button
          variant={showProjected ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowProjected((v) => !v)}
        >
          {showProjected ? "Hide Projections" : "Show Projections"}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading calendar...
        </div>
      ) : (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_HEADERS.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-muted-foreground py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {grid.flatMap((week, wi) =>
              week.map((day, di) => {
                if (day === null) {
                  return <div key={`${wi}-${di}`} className="min-h-[100px]" />;
                }
                const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const projectedItems = showProjected
                  ? (data?.projected ?? []).filter((p) => p.date === dateStr)
                  : [];
                return (
                  <DayCell
                    key={day}
                    day={day}
                    metrics={metricsMap.get(day)}
                    isToday={isCurrentMonth && day === todayDate}
                    onClick={() => handleDayClick(day)}
                    projectedItems={projectedItems}
                  />
                );
              })
            )}
          </div>
        </>
      )}

      {/* Day drill-down sheet */}
      {selectedDay && (
        <DaySheet date={selectedDay} onClose={() => setSelectedDay(null)} />
      )}

      {/* Transaction form (shared) */}
      <TransactionForm />
    </div>
  );
}
