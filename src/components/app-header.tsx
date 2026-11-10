import { Link } from "@tanstack/react-router";
import { FlaskConical, OctagonPause, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DEMO_AS_OF } from "@/lib/trading/market-data";
import { useTrading } from "@/lib/trading/store";
import { shortDate } from "@/lib/format";

export function AppHeader() {
  const { killSwitch, resetDemo } = useTrading();
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur-md md:px-5">
        <SidebarTrigger />
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 font-semibold text-warning">
            <FlaskConical className="size-3.5" /> SIMULATED · DEMO DATA
          </span>
          <span className="hidden lg:inline">Prices are synthetic, as of {shortDate(DEMO_AS_OF)} — not live market data.</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {killSwitch && (
            <Link to="/risk" className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
              <OctagonPause className="size-3.5" /> Kill switch active
            </Link>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <RotateCcw /> <span className="hidden sm:inline">Reset demo</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset the demo?</AlertDialogTitle>
                <AlertDialogDescription>
                  This restores the starting virtual portfolio, journal and risk limits. Nothing real is affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    resetDemo();
                    toast.success("Demo reset to starting state");
                  }}
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>
      {killSwitch && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-center text-sm text-destructive">
          Trading is paused by the kill switch. New simulated trades are blocked until you{" "}
          <Link to="/risk" className="font-semibold underline underline-offset-2">
            resume manually
          </Link>
          .
        </div>
      )}
    </>
  );
}
