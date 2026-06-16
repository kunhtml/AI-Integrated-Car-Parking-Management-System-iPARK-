export type Role = "admin" | "staff" | "user";

export type View = 
    | "overview"
    | "sessions"
    | "users"
    | "pricing"
    | "reports"
    | "profile"
    | "wallet"    
    | "vehicles"
    | "feedback"
    | "notifications"
    | "shifts"
    | "incidents"
    | "ai"
    | "devices"
    | "security";


export type DemoUser = {
    id: number | string;
    name: string; 
    email: string;
    password?: string;
    role: Role;
    status: "Đang hoạt động" | "Đã khóa";
    wallet: number;
    avatarUrl?: string;
    provider?: string;
    twoFactorEnabled?: boolean; 
};

export type FeeBreakdown = {
    totalMinutes: number;
    freeMinutes: number;
    billableMinutes: number;
    billableHours: number;
    hourlyRate: number;
    parkingFee: number;
    overdueFine: number;
    totalFee: number;
};

export type AuthMode = "login" | "register" | "forgot";
