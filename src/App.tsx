import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig, motion } from "motion/react";
import { Sidebar } from "./components/Sidebar";
import { AmbientBackground } from "./components/AmbientBackground";
import { stagger } from "./components/motion";
import { useNav } from "./data/nav";
import { useApplyPrefs, usePrefs } from "./data/prefs";
import { TodayPage } from "./features/today/TodayPage";
import { TasksPage } from "./features/tasks/TasksPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { FinancePage } from "./features/finance/FinancePage";
import { HealthPage } from "./features/health/HealthPage";
import { NotesPage } from "./features/notes/NotesPage";
import "./index.css";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  );
}

function Shell() {
  const page = useNav((s) => s.page);
  const navigate = useNav((s) => s.navigate);
  const prefs = usePrefs();
  useApplyPrefs(prefs);
  return (
    <>
      {/* Honors the system "Reduce motion" setting, or the in-app one: springs become instant. */}
      <MotionConfig reducedMotion={prefs.motion === "reduced" ? "always" : "user"}>
        {prefs.style === "glass" && <AmbientBackground />}
        <div className="flex h-screen overflow-hidden">
          <Sidebar active={page} onNavigate={(p) => navigate(p)} />
          <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-10 pb-12 pt-9">
            {/* Keyed by page so each switch replays the staggered card entrance. */}
            <motion.div key={page} variants={stagger(0.05)} initial="initial" animate="animate">
              {page === "today" && <TodayPage onNavigate={navigate} />}
              {page === "tasks" && <TasksPage />}
              {page === "projects" && <ProjectsPage />}
              {page === "finance" && <FinancePage />}
              {page === "health" && <HealthPage />}
              {page === "notes" && <NotesPage />}
            </motion.div>
          </main>
        </div>
      </MotionConfig>
    </>
  );
}
