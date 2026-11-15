import { AppShell } from "@/components/app-shell";
import { GroupsWorkspace } from "@/components/groups/groups-workspace";

export default function GroupsPage() {
  return <AppShell title="Groups" description="Keep people and shared expenses in one place." active="groups"><GroupsWorkspace /></AppShell>;
}
