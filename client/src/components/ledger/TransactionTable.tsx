import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TypeBadge } from "@/components/ui/TypeBadge";
import { fetchTransactions, patchTransaction, deleteTransaction } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Transaction, TransactionType } from "@/types";
import { Pencil, Trash2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

const TRANSACTION_TYPES: TransactionType[] = [
  "INCOME",
  "BILL",
  "DEBT",
  "SPENDING",
  "SUBSCRIPTION",
];

export function TransactionTable() {
  const { filters, setFilters, openForm } = useAppStore();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState(filters.search);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({ search: searchInput, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setFilters]);

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => fetchTransactions(filters),
  });

  const reconcileMutation = useMutation({
    mutationFn: ({ id, reconciled }: { id: string; reconciled: boolean }) =>
      patchTransaction(id, { reconciled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setDeleteTarget(null);
    },
  });

  const transactions = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 50, pages: 0 };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by name..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-64"
        />
        <Select
          value={filters.type || "ALL"}
          onValueChange={(v) => setFilters({ type: v === "ALL" ? "" : v as TransactionType, page: 1 })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {TRANSACTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.reconciled || "ALL"}
          onValueChange={(v) =>
            setFilters({
              reconciled: v === "ALL" ? "" : (v as "true" | "false"),
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="true">Reconciled</SelectItem>
            <SelectItem value="false">Unreconciled</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filters.start}
          onChange={(e) => setFilters({ start: e.target.value, page: 1 })}
          className="w-40"
          placeholder="Start date"
        />
        <Input
          type="date"
          value={filters.end}
          onChange={(e) => setFilters({ end: e.target.value, page: 1 })}
          className="w-40"
          placeholder="End date"
        />
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-center">Reconciled</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          ) : transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No transactions found
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((txn) => {
              const isYnab = txn.source === "YNAB";
              return (
                <TableRow key={txn.id}>
                  <TableCell>{formatDate(txn.date)}</TableCell>
                  <TableCell>
                    <TypeBadge type={txn.type} />
                  </TableCell>
                  <TableCell className="font-medium">{txn.name}</TableCell>
                  <TableCell
                    className={`text-right font-mono ${
                      txn.amount >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(txn.amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={txn.reconciled}
                      disabled={isYnab}
                      onCheckedChange={(checked) =>
                        reconcileMutation.mutate({
                          id: txn.id,
                          reconciled: checked === true,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {isYnab ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                        <RefreshCw className="h-3 w-3" />
                        YNAB
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Manual</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {txn.notes}
                  </TableCell>
                  <TableCell className="text-right">
                    {isYnab ? (
                      <span className="text-xs text-muted-foreground italic">
                        Read-only
                      </span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openForm(txn)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(txn)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(meta.page - 1) * meta.limit + 1}–
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => setFilters({ page: meta.page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.pages}
              onClick={() => setFilters({ page: meta.page + 1 })}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
