import { QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Sidebar } from "./components/Sidebar";
import { AmbientBackground } from "./components/AmbientBackground";
import { ScrollRootContext, springs, stagger } from "./components/motion";
import { useRef } from "react";
import { queryClient } from "./data/queryClient";
import { useSession } from "./data/session";
import { SignInScreen } from "./features/accounts/SignInScreen";
import { useNav } from "./data/nav";
import { useApplyPrefs, usePrefs } from "./data/prefs";
import { TodayPage } from "./features/today/TodayPage";
import { TasksPage } from "./features/tasks/TasksPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { CalendarPage } from "./features/calendar/CalendarPage";
import { FinancePage } from "./features/finance/FinancePage";
import { HealthPage } from "./features/health/HealthPage";
import { NotesPage } from "./features/notes/NotesPage";
import "./index.css";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  );
}

/** Sign-in screen until an account is chosen; then that account's workspace, remounted per account. */
function Root() {
  const accountId = useSession((s) => s.accountId);
  return (
    <AnimatePresence mode="wait">
      {accountId === null ? (
        <motion.div key="signin" exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)", transition: { duration: 0.25 } }}>
          <MotionConfig reducedMotion="user">
            <SignInScreen />
          </MotionConfig>
        </motion.div>
      ) : (
        <motion.div
          key={accountId}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1, transition: springs.gentle }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
        >
          <Shell />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Shell() {
  const page = useNav((s) => s.page);
  const navigate = useNav((s) => s.navigate);
  const prefs = usePrefs();
  useApplyPrefs(prefs);
  const mainRef = useRef<HTMLElement>(null);
  return (
    <>
      {/* Honors the system "Reduce motion" setting, or the in-app one: springs become instant. */}
      <MotionConfig reducedMotion={prefs.motion === "reduced" ? "always" : "user"}>
        {prefs.style === "glass" && <AmbientBackground />}
        <div className="flex h-screen overflow-hidden">
          <Sidebar active={page} onNavigate={(p) => navigate(p)} />
          <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-10 pb-12 pt-9">
            {/* Keyed by page so each switch replays the staggered card entrance. */}
            <ScrollRootContext.Provider value={mainRef}>
            <motion.div key={page} variants={stagger(0.05)} initial="initial" animate="animate">
              {page === "today" && <TodayPage onNavigate={navigate} />}
              {page === "tasks" && <TasksPage />}
              {page === "projects" && <ProjectsPage />}
              {page === "calendar" && <CalendarPage />}
              {page === "finance" && <FinancePage />}
              {page === "health" && <HealthPage />}
              {page === "notes" && <NotesPage />}
            </motion.div>
            </ScrollRootContext.Provider>
          </main>
        </div>
      </MotionConfig>
    </>
  );
}
