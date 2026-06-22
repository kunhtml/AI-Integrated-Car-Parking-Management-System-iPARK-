import { CheckCircle2 } from "lucide-react";

export function SystemLog({ message }: { message: string }) {
  return (
    <div className="system-log">
      <CheckCircle2 size={16} />
      <span>{message}</span>
    </div>
  );
}
