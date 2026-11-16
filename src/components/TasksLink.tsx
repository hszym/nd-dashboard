"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { currentUserId, loadTaskCounts } from "@/lib/tasks";

/** "My tasks" entry for the top pill / bar, with the person's total open tasks. */
export default function TasksLink({ className = "" }: { className?: string }) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let live = true;
    currentUserId().then((id) => {
      if (!id) return;
      loadTaskCounts(id).then((c) => {
        if (live) setTotal(Object.values(c).reduce((a, b) => a + b, 0));
      });
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <Link href="/tasks" className={`flex items-center gap-1.5 font-medium hover:text-slate-500 ${className}`}>
      My tasks
      {total > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold leading-none text-white">
          {total > 9 ? "9+" : total}
        </span>
      )}
    </Link>
  );
}
