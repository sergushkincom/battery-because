import { MARKET_LABEL } from "./labels";
import { formatEUR, type Locale } from "./format";
import { formatClock } from "./time";
import type { DispatchInterval, WeatherDriver } from "./types";

export function slotStory(
  interval: DispatchInterval,
  timeZone: string,
  weather: WeatherDriver | null,
  locale: Locale = "en-GB",
): string {
  const time = formatClock(interval.ts, timeZone);
  if (interval.quality === "delayed") {
    return `${time} — Not settled. Data delayed — last telemetry 14:05.`;
  }
  if (interval.quality === "missing") {
    return `${time} — Missing. A telemetry gap means this interval has no power or revenue figure.`;
  }
  if (interval.outageReason === "inverter_fault" && interval.powerKw === 0) {
    return `${time} — Offline. Inverter fault, so power is 0 MW and revenue is ${formatEUR(0, locale, 0)}.`;
  }
  if (interval.powerKw === 0 || !interval.market || interval.priceEurMwh == null) {
    return `${time} — Held. No energy trade in this interval.`;
  }
  const mw = Math.abs(interval.powerKw) / 1000;
  const price = interval.priceEurMwh.toFixed(0);
  const earned = formatEUR(interval.revenueCents, locale, 0);
  // Plain words, never the internal market code.
  const market = interval.market === "ID" ? "intraday" : interval.market === "DA" ? "day-ahead" : MARKET_LABEL[interval.market];
  const verb = interval.powerKw > 0 ? "Discharged" : "Charged";
  let text = `${time} — ${verb} ${mw.toFixed(1)} MW on ${market} at €${price}/MWh.`;
  if (interval.market === "ID" && interval.daEurMwh != null) {
    text += ` Day-ahead was €${interval.daEurMwh.toFixed(0)}/MWh.`;
  }
  text += ` Earned ${earned}.`;
  if (weather && interval.powerKw > 0 && interval.market === "ID") {
    const dropGw = (weather.solarFcMw - weather.solarActMw) / 1000;
    if (dropGw >= 1) {
      text += ` Why: solar was ${dropGw.toFixed(1)} GW below forecast, and the intraday price rose.`;
    }
  }
  return text;
}
