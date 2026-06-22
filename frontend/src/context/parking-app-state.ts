import {
  demoUsers,
  initialPaymentConfig,
  initialPricingConfig,
  initialSessions,
  initialVehicles,
} from "@/lib/mock-data";
import { todayInputValue } from "@/lib/constants";
import type {
  AuthMode,
  DemoUser,
  DeviceItem,
  FeedbackItem,
  IncidentItem,
  NotificationItem,
  ParkingSession,
  PaymentConfig,
  PricingConfig,
  RegisteredVehicle,
  ReportSummary,
  ShiftItem,
  TransactionItem,
} from "@/types";

export type ParkingAppState = {
  mode: AuthMode;
  currentUser: DemoUser | null;
  sessions: ParkingSession[];
  registeredVehicles: RegisteredVehicle[];
  userList: DemoUser[];
  searchText: string;
  authError: string;
  mobileNavOpen: boolean;
  actionLog: string;
  exitSessionId: string;
  pricingConfigState: PricingConfig;
  paymentConfigState: PaymentConfig;
  transactionList: TransactionItem[];
  notificationList: NotificationItem[];
  feedbackList: FeedbackItem[];
  deviceList: DeviceItem[];
  shiftList: ShiftItem[];
  incidentList: IncidentItem[];
  twoFactorQr: string;
  reportFrom: string;
  reportTo: string;
  reportSummary: ReportSummary | null;
  sessionLoading: boolean;
  membershipActive: boolean;
  membershipExpiresAt: string;
};

export function createInitialState(): ParkingAppState {
  return {
    mode: "login",
    currentUser: demoUsers[0] ?? null,
    sessions: initialSessions,
    registeredVehicles: initialVehicles,
    userList: demoUsers,
    searchText: "",
    authError: "",
    mobileNavOpen: false,
    actionLog: "Sẵn sàng vận hành.",
    exitSessionId: "",
    pricingConfigState: initialPricingConfig,
    paymentConfigState: initialPaymentConfig,
    transactionList: [],
    notificationList: [],
    feedbackList: [],
    deviceList: [],
    shiftList: [],
    incidentList: [],
    twoFactorQr: "",
    reportFrom: todayInputValue(),
    reportTo: todayInputValue(),
    reportSummary: null,
    sessionLoading: false,
    membershipActive: false,
    membershipExpiresAt: "",
  };
}
