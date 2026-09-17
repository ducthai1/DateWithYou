"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Trời chỗ NGƯỜI KIA đang đứng.
 *
 * Bản cũ chỉ lấy thời tiết của điểm đến và hiện nó trong ô của chính mình, nên
 * ô của người kia trống trơn — hai người đi cùng một chuyến mà chỉ một bên biết
 * bên kia đang gặp gì. Ở Sài Gòn thì chuyện này không nhỏ: một cơn mưa rào có
 * thể chỉ đổ ở nửa quãng đường.
 *
 * Open-Meteo không cần khoá, không cần thẻ, và cho phép dùng phi thương mại
 * 10.000 lượt/ngày — nhưng vị trí người kia nhích vài giây một lần, nên phải
 * chặn: chỉ gọi lại khi họ đã đi được vài cây số, hoặc sau mười lăm phút.
 */

type Weather = { temp: number; desc: string } | null;

/** Chừng này mét thì thời tiết mới có thể khác đi một cách đáng nói. */
const REFETCH_DISTANCE_M = 4000;
/** Và dù đứng yên thì mười lăm phút cũng nên hỏi lại. */
const REFETCH_MS = 15 * 60_000;

/** Mã WMO của Open-Meteo, dịch sang câu người ta nói. */
export function describeWeatherCode(code: number): string {
  if (code >= 95) return "Giông";
  if (code >= 80) return "Mưa to rào";
  if (code >= 71 && code <= 77) return "Tuyết";
  if (code >= 51 && code <= 69) return "Mưa rào nhẹ";
  if (code >= 45 && code <= 48) return "Sương mù";
  if (code >= 1 && code <= 3) return "Nhiều mây";
  return "Trời quang";
}

/** Mét giữa hai điểm, đủ chính xác cho việc quyết định có gọi lại hay không. */
function roughMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (a.lat - b.lat) * 111_320;
  const dLng = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

export function usePartnerWeather(geo: { lat: number; lng: number } | null | undefined): Weather {
  const [weather, setWeather] = useState<Weather>(null);
  const lastAt = useRef(0);
  const lastGeo = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!geo) {
      setWeather(null);
      lastGeo.current = null;
      return;
    }
    const now = Date.now();
    const moved = lastGeo.current ? roughMetres(lastGeo.current, geo) : Infinity;
    if (moved < REFETCH_DISTANCE_M && now - lastAt.current < REFETCH_MS) return;

    lastAt.current = now;
    lastGeo.current = geo;
    const ctrl = new AbortController();
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lng}&current=temperature_2m,weather_code`,
      { signal: ctrl.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.current) return;
        setWeather({
          temp: d.current.temperature_2m,
          desc: describeWeatherCode(d.current.weather_code),
        });
      })
      .catch(() => {
        // Thời tiết là thông tin thêm; hỏng thì im, không làm phiền người đang lái.
      });
    return () => ctrl.abort();
  }, [geo]);

  return weather;
}
