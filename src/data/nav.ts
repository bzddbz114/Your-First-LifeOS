import { create } from "zustand";
import type { PageId } from "../components/Sidebar";

export type TasksView = "list" | "week";

interface NavState {
  page: PageId;
  tasksView: TasksView;
  navigate: (page: PageId, tasksView?: TasksView) => void;
  setTasksView: (view: TasksView) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

export const useNav = create<NavState>((set) => ({
  page: "today",
  tasksView: "list",
  navigate: (page, tasksView) => set((s) => ({ page, tasksView: tasksView ?? s.tasksView })),
  setTasksView: (tasksView) => set({ tasksView }),
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}));
