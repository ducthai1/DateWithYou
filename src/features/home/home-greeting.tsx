"use client";

// Time-of-day greeting + the days-together line. The hour is read AFTER mount:
// the server renders in UTC and the browser in Saigon time, so computing it
// during render would hand React two different strings and force a hydration
// re-render of the whole screen. A one-frame skeleton is cheaper than that.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { viNumber } from "./home-format";

type Greeting = { title: string; sub: string };

function greetingFor(hour: number): Greeting {
  if (hour >= 5 && hour < 11)
    return { title: "Chào buổi sáng", sub: "Hôm nay của tụi mình có gì nào?" };
  if (hour >= 11 && hour < 13)
    return { title: "Trưa rồi đó", sub: "Nghỉ tay chút, ngó qua hôm nay nhé." };
  if (hour >= 13 && hour < 18)
    return { title: "Chào buổi chiều", sub: "Chiều nay tụi mình có gì hay không?" };
  if (hour >= 18 && hour < 22)
    return { title: "Tối rồi", sub: "Ngồi xuống xem hôm nay đã có gì nào." };
  return { title: "Khuya rồi", sub: "Ngó lại một chút rồi đi ngủ nha." };
}

interface HomeGreetingProps {
  /** null while the query is in flight, or when the couple hasn't set a date. */
  daysTogether: number | null;
  /** True until `dashboard.today` resolves — hides the days line, no fake 0. */
  pending: boolean;
}

export function HomeGreeting({ daysTogether, pending }: HomeGreetingProps) {
  const [greeting, setGreeting] = useState<Greeting | null>(null);
  useEffect(() => setGreeting(greetingFor(new Date().getHours())), []);

  return (
    <header className="space-y-1.5">
      {greeting ? (
        <>
          <h1 className="text-h1 text-accent font-semibold">{greeting.title}</h1>
          <p className="text-muted-foreground text-sm">{greeting.sub}</p>
        </>
      ) : (
        <>
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-64" />
        </>
      )}

      {!pending && daysTogether !== null && (
        <p className="text-foreground/80 flex items-center gap-1.5 pt-1 text-sm">
          <Heart className="text-accent h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>
            Tụi mình đã bên nhau{" "}
            <strong className="font-semibold">{viNumber(daysTogether)} ngày</strong>
          </span>
        </p>
      )}

      {!pending && daysTogether === null && (
        <p className="text-muted-foreground pt-1 text-sm">
          <Link
            href="/settings"
            className="text-accent focus-visible:ring-ring/50 rounded underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2"
          >
            Đặt ngày kỷ niệm
          </Link>{" "}
          để tụi mình bắt đầu đếm ngày bên nhau.
        </p>
      )}
    </header>
  );
}
