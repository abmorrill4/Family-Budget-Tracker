import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createRecurringRule, updateRecurringRule } from "@/lib/api";
import type { RecurringRule, RecurringFrequency, TransactionType } from "@/types";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FREQUENCIES: RecurringFrequency[] = ["WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY", "QUARTERLY", "YEARLY"];

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: RecurringRule | null;
}

const defaultForm = {
  name: "",
  amount: "",
  type: "BILL" as TransactionType,
  frequency: "MONTHLY" as RecurringFrequency,
  anchorDay1: "1",
  anchorDay2: "15",
  anchorDow: "1",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  notes: "",
  active: true,
};

export default function RecurringRuleForm({ open, onClose, editing }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() =>
    editing
      ? {
          name: editing.name,
          amount: String(Math.abs(editing.amount)),
          type: editing.type,
          frequency: editing.frequency,
          anchorDay1: String(editing.anchorDays[0] ?? 1),
          anchorDay2: String(editing.anchorDays[1] ?? 15),
          anchorDow: String(editing.anchorDays[0] ?? 1),
          startDate: editing.startDate,
          endDate: editing.endDate ?? "",
          notes: editing.notes ?? "",
          active: editing.active,
        }
      : { ...defaultForm }
  );

  function buildPayload() {
    const rawAmount = parseFloat(form.amount);
    const amount = form.type === "INCOME" ? Math.abs(rawAmount) : -Math.abs(rawAmount);

    let anchorDays: number[] = [];
    if (form.frequency === "WEEKLY" || form.frequency === "BIWEEKLY") {
      anchorDays = [parseInt(form.anchorDow)];
    } else if (form.frequency === "SEMIMONTHLY") {
      anchorDays = [parseInt(form.anchorDay1), parseInt(form.anchorDay2)];
    } else if (form.frequency !== "YEARLY") {
      anchorDays = [parseInt(form.anchorDay1)];
    }

    return {
      name: form.name,
      amount,
      type: form.type,
      frequency: form.frequency,
      anchorDays,
      startDate: form.startDate,
      endDate: form.endDate || null,
      notes: form.notes || null,
      active: form.active,
    };
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload = buildPayload();
      return editing
        ? updateRecurringRule(editing.id, payload)
        : createRecurringRule(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-rules"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      toast.success(editing ? "Rule updated" : "Rule created");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof typeof form) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Recurring Rule" : "New Recurring Rule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Mortgage" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type")(v as TransactionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["INCOME", "BILL", "DEBT", "SPENDING", "SUBSCRIPTION"] as TransactionType[]).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input type="number" min="0" step="0.01" value={form.amount}
                onChange={(e) => set("amount")(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Frequency</Label>
            <Select value={form.frequency} onValueChange={(v) => set("frequency")(v as RecurringFrequency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(form.frequency === "WEEKLY" || form.frequency === "BIWEEKLY") && (
            <div className="space-y-1">
              <Label>Day of Week</Label>
              <Select value={form.anchorDow} onValueChange={set("anchorDow")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {form.frequency === "SEMIMONTHLY" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Day of Month</Label>
                <Input type="number" min="1" max="28" value={form.anchorDay1}
                  onChange={(e) => set("anchorDay1")(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Second Day of Month</Label>
                <Input type="number" min="1" max="28" value={form.anchorDay2}
                  onChange={(e) => set("anchorDay2")(e.target.value)} />
              </div>
            </div>
          )}
          {(form.frequency === "MONTHLY" || form.frequency === "QUARTERLY") && (
            <div className="space-y-1">
              <Label>Day of Month</Label>
              <Input type="number" min="1" max="31" value={form.anchorDay1}
                onChange={(e) => set("anchorDay1")(e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => set("startDate")(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End Date (optional)</Label>
              <Input type="date" value={form.endDate} onChange={(e) => set("endDate")(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !form.name || !form.amount}
            >
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
