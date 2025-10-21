import { Link, useLocation } from "wouter";
import { Leaf, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export default function Header() {
  const [location] = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  
  const { data: settings } = useQuery<{ appName: string }>({
    queryKey: ["/api/settings"],
  });

  const navItems = [
    { href: "/", label: "Map" },
    { href: "/survey", label: "Participate" },
    { href: "/education", label: "Learn More" },
    { href: "/admin", label: "Admin" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card">
      <div className="flex h-16 items-center px-4 gap-4">
        <Link href="/" className="flex items-center gap-2 hover-elevate px-2 py-1 rounded-md">
          <Leaf className="h-6 w-6 text-primary" data-testid="icon-logo" />
          <span className="font-serif font-semibold text-lg" data-testid="text-site-title">
            {settings?.appName || "Molin Nature Area Neighborhood Support"}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-2 ml-auto">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={location === item.href ? "default" : "ghost"}
                data-testid={`link-nav-${item.label.toLowerCase().replace(" ", "-")}`}
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild className="md:hidden ml-auto">
            <Button variant="ghost" size="icon" data-testid="button-menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle>Navigation Menu</SheetTitle>
            <SheetDescription>Navigate to different sections</SheetDescription>
            <nav className="flex flex-col gap-2 mt-4">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={location === item.href ? "default" : "ghost"}
                    className="w-full justify-start"
                    data-testid={`link-mobile-${item.label.toLowerCase().replace(" ", "-")}`}
                    onClick={() => setSheetOpen(false)}
                  >
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
