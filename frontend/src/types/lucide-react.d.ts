declare module "lucide-react" {
  import type { FC, SVGProps } from "react";

  export type LucideProps = SVGProps<SVGSVGElement> & {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
  };

  export type LucideIcon = FC<LucideProps>;

  export const AlertCircle: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const Ban: LucideIcon;
  export const BarChart: LucideIcon;
  export const BarChart3: LucideIcon;
  export const Bell: LucideIcon;
  export const Bot: LucideIcon;
  export const CalendarDays: LucideIcon;
  export const Camera: LucideIcon;
  export const Car: LucideIcon;
  export const Check: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const CircleAlert: LucideIcon;
  export const Clock3: LucideIcon;
  export const Cpu: LucideIcon;
  export const CreditCard: LucideIcon;
  export const Edit2: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const FileDown: LucideIcon;
  export const KeyRound: LucideIcon;
  export const LayoutDashboard: LucideIcon;
  export const Loader2: LucideIcon;
  export const Lock: LucideIcon;
  export const LogIn: LucideIcon;
  export const LogOut: LucideIcon;
  export const Mail: LucideIcon;
  export const MapPin: LucideIcon;
  export const Menu: LucideIcon;
  export const Package: LucideIcon;
  export const ParkingCircle: LucideIcon;
  export const Pencil: LucideIcon;
  export const Phone: LucideIcon;
  export const Play: LucideIcon;
  export const PlusCircle: LucideIcon;
  export const QrCode: LucideIcon;
  export const ReceiptText: LucideIcon;
  export const RefreshCcw: LucideIcon;
  export const Save: LucideIcon;
  export const ScanLine: LucideIcon;
  export const Search: LucideIcon;
  export const Settings: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const Smartphone: LucideIcon;
  export const Trash2: LucideIcon;
  export const Upload: LucideIcon;
  export const User: LucideIcon;
  export const UserRound: LucideIcon;
  export const UsersRound: LucideIcon;
  export const Video: LucideIcon;
  export const Wallet: LucideIcon;
  export const Wrench: LucideIcon;
  export const X: LucideIcon;
}
