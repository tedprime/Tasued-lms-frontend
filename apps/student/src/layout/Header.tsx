import { DataRefresh } from "@tasued/ui";
import { useNavigate } from "react-router-dom";
import { Menu as MenuIcon, User, Settings, LogOut } from "lucide-react";
import { Avatar, Menu } from "@tasued/ui";
import { useLogout, useSession } from "../app/session";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationsPopover } from "./NotificationsPopover";

/** Header ported from SLAN's DashboardHeader: menu button (mobile), pill search, bell, account menu. */
export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const logout = useLogout();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white/95 px-3 backdrop-blur sm:px-4">
      <button type="button" onClick={onMenuClick} aria-label="Open menu" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-primary-500 md:hidden">
        <MenuIcon className="size-5" />
      </button>
      <div className="mx-auto w-full max-w-xl min-w-0 flex-1">
        <GlobalSearch />
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <DataRefresh />
        <NotificationsPopover />
        <Menu
          trigger={
            <button type="button" aria-label="Account menu" aria-haspopup="menu" className="rounded-full ring-primary-500 ring-offset-2 focus-visible:ring-2">
              <Avatar name={user.fullName} src={user.avatarUrl} size={36} className="bg-tertiary-light text-tertiary-100" />
            </button>
          }
          items={[
            { label: <span className="block max-w-[200px]"><span className="block truncate font-semibold">{user.fullName}</span><span className="block truncate text-xs text-neutral-500">{user.email}</span></span>, onClick: () => navigate("/profile") },
            "divider",
            { label: "Profile", icon: <User className="size-4 text-neutral-400" />, onClick: () => navigate("/profile") },
            { label: "Settings", icon: <Settings className="size-4 text-neutral-400" />, onClick: () => navigate("/settings") },
            "divider",
            { label: logout.isPending ? "Signing out…" : "Sign out", icon: <LogOut className="size-4" />, danger: true, disabled: logout.isPending, onClick: () => logout.mutate() },
          ]}
        />
      </div>
    </header>
  );
}
