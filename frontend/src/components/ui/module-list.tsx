import { CheckCircle2 } from "lucide-react";

export function ModuleList({
  icon,
  kicker,
  title,
  items,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  items: string[];
}) {
  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p>{kicker}</p>
          <h2>{title}</h2>
        </div>
        {icon}
      </div>
      <div className="module-list">
        {items.map((item) => (
          <div className="module-item" key={item}>
            <CheckCircle2 size={16} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
