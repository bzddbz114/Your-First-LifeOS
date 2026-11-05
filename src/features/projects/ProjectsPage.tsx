import { PageHeader } from "../../components/Card";
import { ProjectsView } from "./ProjectsView";

export function ProjectsPage() {
  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-5">
      <PageHeader title="项目" />
      <ProjectsView />
    </div>
  );
}
