import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { createTransaction, updateTransaction } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { TransactionType } from "@/types";

const TRANSACTION_TYPES: TransactionType[] = [
  "INCOME",
  "BILL",
  "DEBT",
  "SPENDING",
  "SUBSCRIPTION",
];

export function TransactionForm() {
  const { formOpen, editingTransaction, prefillDate, closeForm } = useAppStore();
  const queryClient = useQueryClient();

  const [date, setDate] = useState("");
  const [type, setType] = useState<TransactionType>("SPENDING");
  const [name, setName] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [isInflow, setIsInflow] = useState(false);
  const [reconciled, setReconciled] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (editingTransaction) {
      setDate(editingTransaction.date);
      setType(editingTransaction.type);
      setName(editingTransaction.name);
      setAmountStr(String(Math.abs(editingTransaction.amount)));
      setIsInflow(editingTransaction.amount > 0);
      setReconciled(editingTransaction.reconciled);
      setNotes(editingTransaction.notes || "");
    } else {
      setDate(prefillDate || new Date().toISOString().slice(0, 10));
      setType("SPENDING");
      setName("");
      setAmountStr("");
      setIsInflow(false);
      setReconciled(false);
      setNotes("");
    }
  }, [editingTransaction, prefillDate, formOpen]);

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createTransaction>[0]) =>
      createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateTransaction>[1];
    }) => updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      closeForm();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const magnitude = parseFloat(amountStr);
    if (isNaN(magnitude) || magnitude === 0) return;
    const amount = isInflow ? magnitude : -magnitude;

    const data = { date, type, name, amount, reconciled, notes: notes || null };

    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  return (
    <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingTransaction ? "Edit Transaction" : "Add Transaction"}
          </DialogTitle>
          <DialogDescription>
            {editingTransaction
              ? "Update the transaction details below."
              : "Enter the details for the new transaction."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Payee or description"
              required
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isInflow ? "default" : "outline"}
                size="sm"
                onClick={() => setIsInflow(true)}
                className="shrink-0"
              >
                + In
              </Button>
              <Button
                type="button"
                variant={!isInflow ? "default" : "outline"}
                size="sm"
                onClick={() => setIsInflow(false)}
                className="shrink-0"
              >
                − Out
              </Button>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="reconciled"
              checked={reconciled}
              onCheckedChange={(checked) => setReconciled(checked === true)}
            />
            <Label htmlFor="reconciled">Reconciled</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              maxLength={1000}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error.message}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? "Saving..."
                : editingTransaction
                  ? "Update"
                  : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
