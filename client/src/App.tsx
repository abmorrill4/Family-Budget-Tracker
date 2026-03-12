import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
} from "react-router-dom";
import { Toaster } from "sonner";
import { Calendar, BookOpen, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import CalendarPage from "@/pages/CalendarPage";
import LedgerPage from "@/pages/LedgerPage";
import RecurringPage from "@/pages/RecurringPage";
import { cn } from "@/lib/utils";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-muted/30 flex flex-col">
        <div className="p-4">
          <h2 className="text-lg font-bold">Budget Tracker</h2>
        </div>
        <Separator />
        <nav className="flex flex-col gap-1 p-2">
          <NavLink
            to="/calendar"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                isActive && "bg-accent text-accent-foreground"
              )
            }
          >
            <Calendar className="h-4 w-4" />
            Calendar
          </NavLink>
          <NavLink
            to="/ledger"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                isActive && "bg-accent text-accent-foreground"
              )
            }
          >
            <BookOpen className="h-4 w-4" />
            Ledger
          </NavLink>
          <NavLink
            to="/recurring"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                isActive && "bg-accent text-accent-foreground"
              )
            }
          >
            <RefreshCw className="h-4 w-4" />
            Recurring
          </NavLink>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/calendar" replace />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/ledger" element={<LedgerPage />} />
            <Route path="/recurring" element={<RecurringPage />} />
          </Routes>
        </Layout>
        <Toaster richColors position="bottom-right" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
