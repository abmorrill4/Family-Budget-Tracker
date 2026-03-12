import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchUnmatched, confirmMatch } from "@/lib/api";

export default function MatchSuggestions() {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const { data } = useQuery({
    queryKey: ["unmatched"],
    queryFn: fetchUnmatched,
    refetchInterval: 60_000,
  });

  const confirmMutation = useMutation({
    mutationFn: ({
      ruleId,
      transactionId,
      projectedDate,
    }: {
      ruleId: string;
      transactionId: string;
      projectedDate: string;
    }) => confirmMatch(ruleId, transactionId, projectedDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unmatched"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Match confirmed — transaction reconciled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const candidates = (data?.data ?? []).filter(
    (c) => !dismissed.has(c.transaction.id)
  );

  if (candidates.length === 0) return null;

  return (
    <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {candidates.length} suggested match{candidates.length !== 1 ? "es" : ""} to reconcile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {candidates.map((c) => (
          <div
            key={c.transaction.id}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <div className="min-w-0">
              <span className="font-medium truncate">{c.transaction.name}</span>
              <span className="text-muted-foreground ml-2">
                ${Math.abs(c.transaction.amount).toFixed(2)} on {c.transaction.date}
              </span>
              <span className="text-muted-foreground ml-2">
                → <em>{c.rule.name}</em>
                <span className="ml-1 text-xs">(projected {c.projectedDate})</span>
              </span>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-green-700 border-green-400 hover:bg-green-50"
                disabled={confirmMutation.isPending}
                onClick={() =>
                  confirmMutation.mutate({
                    ruleId: c.rule.id,
                    transactionId: c.transaction.id,
                    projectedDate: c.projectedDate,
                  })
                }
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-muted-foreground"
                onClick={() =>
                  setDismissed((s) => new Set([...s, c.transaction.id]))
                }
              >
                <XCircle className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
