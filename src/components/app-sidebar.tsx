import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, FlaskConical, LayoutDashboard, LineChart, ShieldCheck, Wallet } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTrading } from "@/lib/trading/store";
import { Logo } from "./logo";

const items = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Market Analysis", url: "/market", icon: LineChart },
  { title: "AI Strategy Lab", url: "/strategy-lab", icon: FlaskConical },
  { title: "Paper Trading", url: "/paper-trading", icon: Wallet },
  { title: "Risk Management", url: "/risk", icon: ShieldCheck },
  { title: "Trade Journal", url: "/journal", icon: BookOpen },
] as const;

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { killSwitch } = useTrading();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpenMobile(false)}>
          <Logo />
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display text-[15px] font-semibold text-sidebar-accent-foreground">TradePilot AI</div>
              <div className="text-[11px] text-muted-foreground">Agentic paper trading</div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title} className="h-10">
                      <Link to={item.url} onClick={() => setOpenMobile(false)}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed ? (
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-sidebar-accent-foreground">
              <span className={`size-2 rounded-full ${killSwitch ? "bg-destructive" : "bg-success animate-pulse"}`} />
              {killSwitch ? "Trading paused" : "Agent online"}
            </div>
            <p className="mt-1 text-muted-foreground">Paper trading only. No real money, no broker connection.</p>
          </div>
        ) : (
          <span className={`mx-auto size-2 rounded-full ${killSwitch ? "bg-destructive" : "bg-success animate-pulse"}`} />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
