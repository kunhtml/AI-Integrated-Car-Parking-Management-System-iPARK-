import { initialPricingConfig } from "@/lib/mock-data";
import { todayInputValue } from "@/lib/constants";
import type {
  AuthMode,
  CapacityChangeLog,
  CapacityConfig,
  CapacityUsage,
  CapacityZoneSummary,
  DemoUser,
  DeviceItem,
  DeviceMaintenanceLog,
  IncidentItem,
  NotificationItem,
  OccupancyHourPoint,
  ParkingSession,
  ParkingSlot,
  PeakHourPoint,
  PricingConfig,
  RegisteredVehicle,
  ReportSummary,
  RevenueChartPoint,
  ShiftItem,
  ShiftScheduleItem,
  Subscription,
  SubscriptionPlan,
  TopCustomer,
  TransactionItem,
  VehicleRequest,
  Zone,
  ZoneSlotsResponse,
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
  transactionList: TransactionItem[];
  notificationList: NotificationItem[];
  deviceList: DeviceItem[];
  shiftList: ShiftItem[];
  shiftScheduleList: ShiftScheduleItem[];
  incidentList: IncidentItem[];
  reportFrom: string;
  reportTo: string;
  reportSummary: ReportSummary | null;
  sessionLoading: boolean;
  zoneList: Zone[];
  slotList: ParkingSlot[];
  planList: SubscriptionPlan[];
  subscriptionList: Subscription[];
  maintenanceLogList: DeviceMaintenanceLog[];
  revenueChart: RevenueChartPoint[];
  occupancyData: OccupancyHourPoint[];
  topCustomers: TopCustomer[];
  peakHours: PeakHourPoint[];
  vehicleRequests: VehicleRequest[];
  capacityConfig: CapacityConfig | null;
  capacityZones: CapacityZoneSummary[];
  capacityUsage: CapacityUsage | null;
  capacityHistory: CapacityChangeLog[];
  zoneSlots: Record<string, ZoneSlotsResponse>;
};

export function createInitialState(): ParkingAppState {
  return {
    mode: "login",
    currentUser: null,
    sessions: [],
    registeredVehicles: [],
    userList: [],
    searchText: "",
    authError: "",
    mobileNavOpen: false,
    actionLog: "",
    exitSessionId: "",
    pricingConfigState: initialPricingConfig,
    transactionList: [],
    notificationList: [],
    deviceList: [],
    shiftList: [],
    shiftScheduleList: [],
    incidentList: [],
    reportFrom: todayInputValue(),
    reportTo: todayInputValue(),
    reportSummary: null,
    sessionLoading: true,
    zoneList: [],
    slotList: [],
    planList: [],
    subscriptionList: [],
    maintenanceLogList: [],
    revenueChart: [],
    occupancyData: [],
    topCustomers: [],
    peakHours: [],
    vehicleRequests: [],
    capacityConfig: null,
    capacityZones: [],
    capacityUsage: null,
    capacityHistory: [],
    zoneSlots: {},
  };
}
