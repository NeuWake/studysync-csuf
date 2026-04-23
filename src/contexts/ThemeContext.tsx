import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type Theme = "light" | "dark";

export interface AccentColor {
  name: string;
  hsl: string;
  preview: string;
}

export const ACCENT_COLORS: AccentColor[] = [
  { name: "Orange", hsl: "25 95% 53%", preview: "#F97316" },
  { name: "Blue", hsl: "217 91% 60%", preview: "#3B82F6" },
  { name: "Violet", hsl: "263 70% 58%", preview: "#8B5CF6" },
  { name: "Rose", hsl: "346 77% 55%", preview: "#E11D48" },
  { name: "Emerald", hsl: "160 84% 39%", preview: "#10B981" },
  { name: "Amber", hsl: "38 92% 50%", preview: "#F59E0B" },
  { name: "Cyan", hsl: "189 94% 43%", preview: "#06B6D4" },
  { name: "Pink", hsl: "330 81% 60%", preview: "#EC4899" },
];

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  accentColor: ACCENT_COLORS[0],
  setAccentColor: () => {},
});

export const useTheme = () => useContext(ThemeContext);

function applyAccentColor(color: AccentColor) {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");

  // Parse "H S% L%" into parts so we can derive subtle tints
  const [hStr, sStr] = color.hsl.split(" ");
  const h = hStr;
  const s = sStr;

  root.style.setProperty("--primary", color.hsl);
  root.style.setProperty("--ring", color.hsl);
  root.style.setProperty("--sidebar-primary", color.hsl);
  root.style.setProperty("--sidebar-ring", color.hsl);

  // Subtle sidebar accent (hover/active row background) tinted by accent color
  if (isDark) {
    root.style.setProperty("--sidebar-accent", `${h} ${s} 15%`);
    root.style.setProperty("--sidebar-accent-foreground", `${h} ${s} 75%`);
    // Very subtle app background tint
    root.style.setProperty("--accent-bg", `${h} 30% 7%`);
    root.style.setProperty("--accent-bg-soft", `${h} 25% 10%`);
  } else {
    root.style.setProperty("--sidebar-accent", `${h} ${s} 95%`);
    root.style.setProperty("--sidebar-accent-foreground", `${h} ${s} 35%`);
    root.style.setProperty("--accent-bg", `${h} 60% 98%`);
    root.style.setProperty("--accent-bg-soft", `${h} 50% 96%`);
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("studysync-theme");
    return (stored as Theme) || "light";
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    const stored = localStorage.getItem("studysync-accent");
    if (stored) {
      const found = ACCENT_COLORS.find((c) => c.name === stored);
      if (found) return found;
    }
    return ACCENT_COLORS[0];
  });

  // Load from DB on auth change
  useEffect(() => {
    const loadFromDb = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("theme_mode, accent_color")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        if (data.theme_mode && (data.theme_mode === "light" || data.theme_mode === "dark")) {
          setTheme(data.theme_mode as Theme);
        }
        if (data.accent_color) {
          const found = ACCENT_COLORS.find((c) => c.name === data.accent_color);
          if (found) setAccentColorState(found);
        }
      }
    };

    loadFromDb();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadFromDb();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Save to DB helper
  const saveToDb = useCallback(async (themeMode: Theme, colorName: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ theme_mode: themeMode, accent_color: colorName } as any)
      .eq("user_id", user.id);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("studysync-theme", theme);
    // Re-apply accent so its tints adapt to light/dark
    applyAccentColor(accentColor);
  }, [theme, accentColor]);

  useEffect(() => {
    applyAccentColor(accentColor);
    localStorage.setItem("studysync-accent", accentColor.name);
  }, [accentColor]);

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      saveToDb(next, accentColor.name);
      return next;
    });
  };

  const setAccentColor = (color: AccentColor) => {
    setAccentColorState(color);
    saveToDb(theme, color.name);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};
