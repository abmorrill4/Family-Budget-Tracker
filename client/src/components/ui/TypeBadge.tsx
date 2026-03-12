import { Badge } from "@/components/ui/badge";
import { TYPE_COLORS } from "@/lib/utils";
import type { TransactionType } from "@/types";

interface TypeBadgeProps {
  type: TransactionType;
}

export function TypeBadge({ type }: TypeBadgeProps) {
  return (
    <Badge variant="outline" className={`${TYPE_COLORS[type]} border-transparent`}>
      {type}
    </Badge>
  );
}
