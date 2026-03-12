import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchRecurringRules, deleteRecurringRule, patchRecurringRule } from "@/lib/api";
import { TypeBadge } from "@/components/ui/TypeBadge";
import RecurringRuleForm from "@/components/recurring/RecurringRuleForm";
import type { RecurringRule } from "@/types";

function formatAmount(amount: number, type: string) {
  const abs = Math.abs(amount).toFixed(2);
  return type === "INCOME" ? `+$${abs}` : `-$${abs}`;
}

function describeSchedule(rule: RecurringRule): string {
  if (rule.frequency === "MONTHLY") return `Monthly on day ${rule.anchorDays[0]}`;
  if (rule.frequency === "SEMIMONTHLY") return `${rule.anchorDays[0]}th & ${rule.anchorDays[1]}th of each month`;
  if (rule.frequency === "QUARTERLY") return `Quarterly on day ${rule.anchorDays[0]}`;
  if (rule.frequency === "YEARLY") return `Yearly on ${rule.startDate.slice(5).replace("-", "/")}`;
  if (rule.frequency === "WEEKLY") return `Weekly on ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][rule.anchorDays[0] ?? 1]}`;
  if (rule.frequency === "BIWEEKLY") return `Every 2 weeks on ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][rule.anchorDays[0] ?? 1]}`;
  return rule.frequency;
}

export default function RecurringPage() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["recurring-rules"],
    queryFn: fetchRecurringRules,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecurringRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-rules"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      toast.success("Rule deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      patchRecurringRule(id, { active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-rules"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rules = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recurring Rules</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Rule
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}

      {!isLoading && rules.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No recurring rules yet. Add your first one to start forecasting.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={rule.id} className={rule.active ? "" : "opacity-50"}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{rule.name}</CardTitle>
                  <TypeBadge type={rule.type} />
                  {!rule.active && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-semibold text-sm ${rule.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatAmount(rule.amount, rule.type)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ id: rule.id, active: !rule.active })}
                    title={rule.active ? "Pause" : "Resume"}
                  >
                    {rule.active ? "⏸" : "▶"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(rule); setFormOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Delete "${rule.name}"?`)) deleteMutation.mutate(rule.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">{describeSchedule(rule)}</p>
              {rule.endDate && (
                <p className="text-xs text-muted-foreground mt-1">Ends {rule.endDate}</p>
              )}
              {rule.notes && <p className="text-sm mt-1">{rule.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <RecurringRuleForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        editing={editing}
      />
    </div>
  );
}
