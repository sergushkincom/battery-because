export type Regime = "sunny_calm" | "windy" | "cloudy_windy" | "dunkelflaute" | "volatile";

export function forcedRegime(date: string): Regime | null {
  if (date >= "2026-11-13" && date <= "2026-11-19") return "cloudy_windy";
  if (date >= "2026-11-09" && date <= "2026-11-10") return "volatile";
  if (date >= "2026-11-06" && date <= "2026-11-08") return "sunny_calm";
  if (date >= "2026-11-11" && date <= "2026-11-12") return "windy";
  if (date >= "2026-10-19" && date <= "2026-10-23") return "dunkelflaute";
  if (date >= "2026-11-20" && date <= "2026-11-21") return "windy";
  if (date === "2026-11-22") return "sunny_calm";
  if (date >= "2026-11-23" && date <= "2026-11-24") return "cloudy_windy";
  if (date >= "2026-11-25") return "sunny_calm";
  return null;
}
