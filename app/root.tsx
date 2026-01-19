import { Outlet, useLocation } from "react-router";
import { useEffect, useState } from "react";

import "./app.css";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./components/ui/ThemeProvider";
import { Navbar } from "~/components/ui/Navbar";
import { MarketingFooter } from "~/components/ui/MarketingFooter";

export default function App() {
  const location = useLocation();
  const [showBrand, setShowBrand] = useState(true);

  const hideNavbar =
    location.pathname === "/" ||
    location.pathname === "/projects" ||
    location.pathname.startsWith("/project/") ||
    location.pathname === "/profile";
  const hideFooter =
    location.pathname === "/" ||
    location.pathname === "/projects" ||
    location.pathname.startsWith("/project/") ||
    location.pathname === "/profile";

  useEffect(() => {
    // Only apply hero intersection logic on the landing page
    if (location.pathname === "/") {
      const hero = document.getElementById("hero-section");
      if (!hero) {
        setShowBrand(true);
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          const e = entries[0];
          setShowBrand(!e.isIntersecting);
        },
        { root: null, threshold: 0.25 }
      );
      observer.observe(hero);
      return () => observer.disconnect();
    } else {
      // On other pages, always show the brand
      setShowBrand(true);
    }
  }, [location.pathname]);

  return (
    <ThemeProvider>
      <main className="min-h-screen w-full overflow-x-hidden font-sans antialiased">
        {!hideNavbar && <Navbar showBrand={showBrand} />}
        <Outlet />
        {!hideFooter && <MarketingFooter />}
      </main>
      <Toaster position="top-right" expand={false} richColors closeButton />
    </ThemeProvider>
  );
}
