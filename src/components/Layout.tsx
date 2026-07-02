import { NavLink, Outlet } from "react-router-dom";
import { Library, Compass, Blocks, Settings } from "lucide-react";
import { cn } from "../lib/utils";

export default function Layout() {
  const navItems = [
    { to: "/", icon: Library, label: "Library" },
    { to: "/discover", icon: Compass, label: "Discover" },
    { to: "/extensions", icon: Blocks, label: "Extensions" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Left Navigation Sidebar */}
      <nav className="w-64 border-r border-border bg-card flex flex-col pt-8 pb-4">
        <div className="px-6 mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-primary">Isekast</h1>
        </div>
        
        <div className="flex-1 flex flex-col gap-2 px-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md transition-colors",
                  "hover:bg-secondary/50",
                  isActive 
                    ? "bg-primary text-primary-foreground font-medium shadow-sm hover:bg-primary/90" 
                    : "text-muted-foreground"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto relative bg-background">
        <Outlet />
      </main>
    </div>
  );
}
