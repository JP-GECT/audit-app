import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

function getInitialTheme(): "light" | "dark" {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const linkBase = "rounded-xl px-3 py-1.5 text-sm font-medium transition-all";

export default function Navbar() {
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <header className="neu-flat sticky top-0 z-20 flex items-center justify-between px-6 py-3" style={{ background: "var(--neu-bg)" }}>
      <div className="flex items-center gap-2.5">
        <div
          className="neu-raised-sm flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold"
          style={{ color: "var(--series-1)" }}
        >
          G
        </div>
        <span className="font-semibold tracking-tight">Provisioning Guardian</span>
      </div>

      <nav className="flex items-center gap-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${linkBase} ${isActive ? "neu-inset" : "hover:opacity-100"}`}
          style={({ isActive }) => ({
            color: isActive ? "var(--series-1)" : "var(--text-secondary)",
            opacity: isActive ? 1 : 0.8,
          })}
        >
          Submit
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) => `${linkBase} ${isActive ? "neu-inset" : "hover:opacity-100"}`}
          style={({ isActive }) => ({
            color: isActive ? "var(--series-1)" : "var(--text-secondary)",
            opacity: isActive ? 1 : 0.8,
          })}
        >
          History
        </NavLink>

        <button
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          className="neu-btn ml-1 flex h-9 w-9 items-center justify-center rounded-full"
          style={{ color: "var(--text-secondary)" }}
          title="Toggle theme"
        >
          {theme === "light" ? (
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
            </svg>
          )}
        </button>
      </nav>
    </header>
  );
}
