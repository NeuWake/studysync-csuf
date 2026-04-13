import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme, ACCENT_COLORS } from "@/contexts/ThemeContext";
import { Palette, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ThemeSettingsCard() {
  const { theme, toggleTheme, accentColor, setAccentColor } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" /> Appearance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Light / Dark toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === "light" ? (
              <Sun className="h-5 w-5 text-warning" />
            ) : (
              <Moon className="h-5 w-5 text-secondary" />
            )}
            <div>
              <Label className="text-sm font-medium">Dark Mode</Label>
              <p className="text-xs text-muted-foreground">
                {theme === "light" ? "Currently using light theme" : "Currently using dark theme"}
              </p>
            </div>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
        </div>

        {/* Accent color picker */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Accent Color</Label>
          <div className="grid grid-cols-4 gap-3">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.name}
                onClick={() => setAccentColor(color)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all hover:scale-105",
                  accentColor.name === color.name
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-transparent bg-muted/50 hover:border-border"
                )}
              >
                <div
                  className="h-8 w-8 rounded-full shadow-inner"
                  style={{ backgroundColor: color.preview }}
                />
                <span className="text-xs font-medium text-foreground">{color.name}</span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
