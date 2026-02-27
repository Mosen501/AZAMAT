import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Terminal, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children, className }: { children: ReactNode; className?: string }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground scanline flex flex-col font-body">
      {/* Top Navbar */}
      <header className="border-b border-primary/20 bg-secondary/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="w-8 h-8 rounded bg-primary/10 border border-primary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-display font-bold text-glow tracking-widest text-primary">
              EDGECASE<span className="text-foreground">.AI</span>
            </h1>
          </Link>
          
          <nav className="flex items-center gap-6 text-sm font-display tracking-wider uppercase">
            <Link 
              href="/" 
              className={cn(
                "hover:text-primary transition-colors cursor-pointer",
                location === "/" ? "text-primary" : "text-muted-foreground"
              )}
            >
              Home
            </Link>
            <Link 
              href="/admin" 
              className={cn(
                "flex items-center gap-2 hover:text-primary transition-colors cursor-pointer",
                location === "/admin" ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Terminal className="w-4 h-4" />
              <span>Admin</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={cn("flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col", className)}>
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-primary/10 bg-secondary/30 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground font-display uppercase tracking-widest">
          <p>© {new Date().getFullYear()} EDGECASE AI. Simulation Platform v1.0.4</p>
          <div className="flex gap-4">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> SYSTEM ONLINE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
