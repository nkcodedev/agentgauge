"use client";

import { useEffect, useState } from "react";
import { formatDurationMs } from "@/lib/format";

export function RunningDuration({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ms = Math.max(0, now - new Date(startedAt).getTime());
  return <span>{formatDurationMs(ms)}</span>;
}
