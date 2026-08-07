"use client";

import Link from "next/link";
import { ArrowRight, Car, Camera, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  variant?: "default" | "outline" | "secondary";
}

const defaultActions: QuickAction[] = [
  {
    label: "Xe mới",
    href: "/dashboard/vehicles",
    icon: <Car className="h-4 w-4" />,
  },
  {
    label: "Kiểm tra camera",
    href: "/dashboard/ai",
    icon: <Camera className="h-4 w-4" />,
    variant: "outline",
  },
  {
    label: "Xuất báo cáo",
    href: "/dashboard/revenue-reports",
    icon: <FileDown className="h-4 w-4" />,
    variant: "outline",
  },
];

interface QuickActionsProps {
  actions?: QuickAction[];
}

export function QuickActions({ actions = defaultActions }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.variant ?? "default"}
          size="sm"
          asChild
        >
          <Link href={action.href}>
            {action.icon}
            {action.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
