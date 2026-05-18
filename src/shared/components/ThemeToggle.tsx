"use client";

import { useTheme } from "next-themes";
import { RiMoonLine, RiSunLine } from "react-icons/ri";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex size-10 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors text-muted-foreground"
      aria-label="Toggle theme"
    >
      <RiSunLine className="size-5 hidden dark:block" />
      <RiMoonLine className="size-5 block dark:hidden" />
    </button>
  );
}
