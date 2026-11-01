import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar, type PageId } from "./components/Sidebar";
import { TodayPage } from "./features/today/TodayPage";
import { TasksPage } from "./features/tasks/TasksPage";
import { FinancePage } from "./features/finance/FinancePage";
import { HealthPage } from "./features/health/HealthPage";
import { NotesPage } from "./features/notes/NotesPage";
import "./index.css";

const queryClient = new QueryClient();

export default function App() {
  const [page, setPage] = useState<PageId>("today");
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen">
        <Sidebar active={page} onNavigate={setPage} />
        <main className="min-w-0 flex-1 px-10 pb-12 pt-9">
          {page === "today" && <TodayPage onNavigate={setPage} />}
          {page === "tasks" && <TasksPage />}
          {page === "finance" && <FinancePage />}
          {page === "health" && <HealthPage />}
          {page === "notes" && <NotesPage />}
        </main>
      </div>
    </QueryClientProvider>
  );
}
