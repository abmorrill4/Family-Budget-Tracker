import { create } from "zustand";
import type { Transaction, TransactionFilters } from "@/types";

interface AppState {
  // Calendar navigation
  calendarYear: number;
  calendarMonth: number;
  setCalendarDate: (year: number, month: number) => void;

  // Selected day for drill-down
  selectedDay: string | null;
  setSelectedDay: (day: string | null) => void;

  // Ledger filters
  filters: TransactionFilters;
  setFilters: (filters: Partial<TransactionFilters>) => void;
  resetFilters: () => void;

  // Transaction form modal
  formOpen: boolean;
  editingTransaction: Transaction | null;
  prefillDate: string | null;
  openForm: (transaction?: Transaction | null, prefillDate?: string) => void;
  closeForm: () => void;
}

const defaultFilters: TransactionFilters = {
  search: "",
  type: "",
  reconciled: "",
  start: "",
  end: "",
  page: 1,
};

const now = new Date();

export const useAppStore = create<AppState>((set) => ({
  calendarYear: now.getFullYear(),
  calendarMonth: now.getMonth() + 1,
  setCalendarDate: (year, month) => set({ calendarYear: year, calendarMonth: month }),

  selectedDay: null,
  setSelectedDay: (day) => set({ selectedDay: day }),

  filters: { ...defaultFilters },
  setFilters: (partial) =>
    set((state) => ({
      filters: { ...state.filters, ...partial },
    })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),

  formOpen: false,
  editingTransaction: null,
  prefillDate: null,
  openForm: (transaction = null, prefillDate) =>
    set({
      formOpen: true,
      editingTransaction: transaction ?? null,
      prefillDate: prefillDate ?? null,
    }),
  closeForm: () =>
    set({
      formOpen: false,
      editingTransaction: null,
      prefillDate: null,
    }),
}));
