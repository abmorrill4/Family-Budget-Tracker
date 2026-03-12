import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionTable } from "@/components/ledger/TransactionTable";
import { TransactionForm } from "@/components/ledger/TransactionForm";
import MatchSuggestions from "@/components/ledger/MatchSuggestions";
import { useAppStore } from "@/lib/store";
import { Plus } from "lucide-react";

export default function LedgerPage() {
  const { openForm } = useAppStore();

  return (
    <div className="space-y-6">
      <MatchSuggestions />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ledger</h1>
        <Button onClick={() => openForm()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionTable />
        </CardContent>
      </Card>

      <TransactionForm />
    </div>
  );
}
