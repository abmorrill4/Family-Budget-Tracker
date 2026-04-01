import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  fetchYnabStatus,
  fetchYnabBudgets,
  fetchYnabAccounts,
  connectYnab,
  syncYnab,
  disconnectYnab,
  updateYnabSettings,
} from "@/lib/api";
import { toast } from "sonner";
import type { YnabBudget, YnabAccount } from "@/types";
import { RefreshCw, Unplug, CheckCircle2, XCircle } from "lucide-react";

const SYNC_INTERVALS = [
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
  { value: 60, label: "Every hour" },
  { value: 180, label: "Every 3 hours" },
  { value: 360, label: "Every 6 hours" },
  { value: 720, label: "Every 12 hours" },
  { value: 1440, label: "Once a day" },
];

export default function YnabPage() {
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["ynab-status"],
    queryFn: fetchYnabStatus,
  });

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading YNAB status...
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">YNAB Integration</h1>
        <p className="text-muted-foreground">
          Connect your YNAB account to automatically import transactions.
        </p>
      </div>

      {status?.connected ? (
        <ConnectedView
          status={status}
          queryClient={queryClient}
        />
      ) : (
        <SetupWizard queryClient={queryClient} />
      )}
    </div>
  );
}

// ─── Connected state ────────────────────────────────────────────────────────

function ConnectedView({
  status,
  queryClient,
}: {
  status: NonNullable<ReturnType<typeof fetchYnabStatus> extends Promise<infer T> ? T : never>;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const conn = status.connection!;

  const syncMutation = useMutation({
    mutationFn: syncYnab,
    onSuccess: (result) => {
      toast.success(
        `Synced: ${result.created} new, ${result.updated} updated, ${result.deleted} removed`
      );
      queryClient.invalidateQueries({ queryKey: ["ynab-status"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectYnab,
    onSuccess: () => {
      toast.success("YNAB disconnected");
      queryClient.invalidateQueries({ queryKey: ["ynab-status"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const settingsMutation = useMutation({
    mutationFn: updateYnabSettings,
    onSuccess: () => {
      toast.success("Settings updated");
      queryClient.invalidateQueries({ queryKey: ["ynab-status"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Connected to YNAB
              </CardTitle>
              <CardDescription>
                Budget: <strong>{conn.budgetName}</strong>
              </CardDescription>
            </div>
            <Badge variant="secondary">
              {status.transactionCount} imported transactions
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last synced</span>
            <span>
              {conn.lastSyncedAt
                ? new Date(conn.lastSyncedAt).toLocaleString()
                : "Never"}
            </span>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${
                  syncMutation.isPending ? "animate-spin" : ""
                }`}
              />
              {syncMutation.isPending ? "Syncing..." : "Sync Now"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              <Unplug className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto-Sync Settings</CardTitle>
          <CardDescription>
            Configure how often transactions are synced from YNAB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Sync Interval</Label>
            <Select
              value={String(conn.syncIntervalMinutes)}
              onValueChange={(v) =>
                settingsMutation.mutate({
                  syncIntervalMinutes: parseInt(v, 10),
                })
              }
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNC_INTERVALS.map((si) => (
                  <SelectItem key={si.value} value={String(si.value)}>
                    {si.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Setup wizard ───────────────────────────────────────────────────────────

function SetupWizard({
  queryClient,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [step, setStep] = useState<"token" | "budget" | "accounts">("token");
  const [token, setToken] = useState("");
  const [budgets, setBudgets] = useState<YnabBudget[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<YnabBudget | null>(null);
  const [accounts, setAccounts] = useState<YnabAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [syncInterval, setSyncInterval] = useState(360);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTokenSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const { budgets: b } = await fetchYnabBudgets(token);
      setBudgets(b);
      if (b.length === 1 && b[0]) {
        setSelectedBudget(b[0]);
        const { accounts: a } = await fetchYnabAccounts(token, b[0].id);
        setAccounts(a);
        setStep("accounts");
      } else {
        setStep("budget");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid token");
    } finally {
      setLoading(false);
    }
  };

  const handleBudgetSelect = async (budgetId: string) => {
    const budget = budgets.find((b) => b.id === budgetId) ?? null;
    if (!budget) return;
    setSelectedBudget(budget);
    setLoading(true);
    setError("");
    try {
      const { accounts: a } = await fetchYnabAccounts(token, budgetId);
      setAccounts(a);
      setStep("accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  const connectMutation = useMutation({
    mutationFn: () =>
      connectYnab({
        token,
        budgetId: selectedBudget!.id,
        budgetName: selectedBudget!.name,
        accountIds: selectedAccountIds,
        syncIntervalMinutes: syncInterval,
      }),
    onSuccess: (result) => {
      toast.success(
        `Connected! Imported ${result.sync.created} transactions.`
      );
      queryClient.invalidateQueries({ queryKey: ["ynab-status"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-muted-foreground" />
          Not Connected
        </CardTitle>
        <CardDescription>
          Enter your YNAB Personal Access Token to get started. You can generate
          one at{" "}
          <a
            href="https://app.ynab.com/settings/developer"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-600"
          >
            app.ynab.com/settings/developer
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Token */}
        {step === "token" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ynab-token">Personal Access Token</Label>
              <Input
                id="ynab-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your YNAB token here"
              />
            </div>
            <Button
              onClick={handleTokenSubmit}
              disabled={!token || loading}
            >
              {loading ? "Validating..." : "Connect"}
            </Button>
          </div>
        )}

        {/* Step 2: Budget selection */}
        {step === "budget" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select a Budget</Label>
              <Select onValueChange={handleBudgetSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a budget..." />
                </SelectTrigger>
                <SelectContent>
                  {budgets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => setStep("token")}>
              Back
            </Button>
          </div>
        )}

        {/* Step 3: Account selection + sync interval */}
        {step === "accounts" && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Budget: <strong>{selectedBudget?.name}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <Label>
                Select Accounts{" "}
                <span className="text-muted-foreground font-normal">
                  (leave all unchecked to import from all accounts)
                </span>
              </Label>
              {accounts.map((acct) => (
                <div key={acct.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={acct.id}
                    checked={selectedAccountIds.includes(acct.id)}
                    onCheckedChange={() => toggleAccount(acct.id)}
                  />
                  <Label htmlFor={acct.id} className="font-normal">
                    {acct.name}{" "}
                    <span className="text-muted-foreground text-xs">
                      ({acct.type})
                    </span>
                  </Label>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Auto-Sync Interval</Label>
              <Select
                value={String(syncInterval)}
                onValueChange={(v) => setSyncInterval(parseInt(v, 10))}
              >
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNC_INTERVALS.map((si) => (
                    <SelectItem key={si.value} value={String(si.value)}>
                      {si.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setStep(budgets.length > 1 ? "budget" : "token")
                }
              >
                Back
              </Button>
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
              >
                {connectMutation.isPending
                  ? "Connecting & Syncing..."
                  : "Connect & Import"}
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
