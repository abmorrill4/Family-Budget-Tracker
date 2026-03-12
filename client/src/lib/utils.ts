import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TransactionType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TYPE_COLORS: Record<TransactionType, string> = {
  INCOME: "bg-emerald-100 text-emerald-800",
  BILL: "bg-amber-100 text-amber-800",
  DEBT: "bg-red-100 text-red-800",
  SPENDING: "bg-blue-100 text-blue-800",
  SUBSCRIPTION: "bg-violet-100 text-violet-800",
};

export function formatCurrency(value: number): string {
  const formatted = Math.abs(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  if (value < 0) return `−${formatted}`;
  if (value > 0) return `+${formatted}`;
  return formatted;
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${month}/${day}/${year}`;
}

export function buildCalendarGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow = firstDay.getDay();

  const grid: (number | null)[][] = [];
  let day = 1;

  for (let row = 0; row < 6; row++) {
    const week: (number | null)[] = [];
    for (let col = 0; col < 7; col++) {
      if (row === 0 && col < startDow) {
        week.push(null);
      } else if (day > daysInMonth) {
        week.push(null);
      } else {
        week.push(day);
        day++;
      }
    }
    grid.push(week);
    if (day > daysInMonth) break;
  }

  return grid;
}
