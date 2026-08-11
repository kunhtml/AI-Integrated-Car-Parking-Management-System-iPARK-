"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createInitialState } from "@/context/parking-app-state";
import { createAnalyticsActions } from "@/hooks/actions/use-analytics-actions";
import { createAuthActions } from "@/hooks/actions/use-auth-actions";
import { createCapacityActions } from "@/hooks/actions/use-capacity-actions";
import { createMiscActions } from "@/hooks/actions/use-misc-actions";
import { createVehicleActions } from "@/hooks/actions/use-vehicle-actions";
import { createPaymentActions } from "@/hooks/actions/use-payment-actions";
import {
  createReportActions,
  useReportSummaryLoader,
} from "@/hooks/actions/use-report-actions";
import { createSessionActions } from "@/hooks/actions/use-session-actions";
import { createSlotActions } from "@/hooks/actions/use-slot-actions";
import { createSubscriptionActions } from "@/hooks/actions/use-subscription-actions";
import { createShiftScheduleActions } from "@/hooks/actions/use-shift-schedule-actions";
import {
  createUserActions,
  type UserUpdatePayload,
} from "@/hooks/actions/use-user-actions";
import { createZoneActions } from "@/hooks/actions/use-zone-actions";
import { useOperationalData } from "@/hooks/use-operational-data";
import { useSessionLoader } from "@/hooks/use-session-loader";
import { parkingConfig } from "@/lib/parking-config";
import { apiFetch } from "@/lib/client-api";
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
  PaymentConfig,
  PeakHourPoint,
  PricingConfig,
  RegisteredVehicle,
  ReportSummary,
  RevenueChartPoint,
  ShiftItem,
  ShiftScheduleItem,
  SlotAccessPolicy,
  SlotStatus,
  Subscription,
  SubscriptionPlan,
  TopCustomer,
  TransactionItem,
  VehicleRequest,
  Zone,
  ZoneSlotsResponse,
} from "@/types";
import type { FormEvent } from "react";

type ParkingAppContextValue = {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  currentUser: DemoUser | null;
  setCurrentUser: (user: DemoUser | null) => void;
  sessions: ParkingSession[];
  setSessions: (
    sessions:
      | ParkingSession[]
      | ((items: ParkingSession[]) => ParkingSession[]),
  ) => void;
  registeredVehicles: RegisteredVehicle[];
  setRegisteredVehicles: (
    vehicles:
      | RegisteredVehicle[]
      | ((prev: RegisteredVehicle[]) => RegisteredVehicle[]),
  ) => void;
  vehicleRequests: VehicleRequest[];
  setVehicleRequests: (
    requests: VehicleRequest[] | ((prev: VehicleRequest[]) => VehicleRequest[]),
  ) => void;
  userList: DemoUser[];
  createUser: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateUser: (id: string, updates: UserUpdatePayload) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  searchText: string;
  setSearchText: (text: string) => void;
  authError: string;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  actionLog: string;
  setActionLog: (message: string) => void;
  exitSessionId: string;
  setExitSessionId: (id: string) => void;
  pricingConfigState: PricingConfig;
  transactionList: TransactionItem[];
  setTransactionList: (
    items: TransactionItem[] | ((prev: TransactionItem[]) => TransactionItem[]),
  ) => void;
  notificationList: NotificationItem[];
  deviceList: DeviceItem[];
  shiftList: ShiftItem[];
  shiftScheduleList: ShiftScheduleItem[];
  incidentList: IncidentItem[];
  reportFrom: string;
  setReportFrom: (from: string) => void;
  reportTo: string;
  setReportTo: (to: string) => void;
  reportSummary: ReportSummary | null;
  sessionLoading: boolean;
  stats: {
    active: number;
    available: number;
    revenue: number;
    completion: number;
  };
  filteredSessions: ParkingSession[];
  handleLogin: (event: FormEvent<HTMLFormElement>) => Promise<unknown>;
  handleRegister: (event: FormEvent<HTMLFormElement>) => Promise<unknown>;
  handleRequestForgotOtp: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleResetPassword: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleVerifyRegister?: (
    event: FormEvent<HTMLFormElement>,
  ) => Promise<unknown>;
  handleResendVerificationOtp?: (email: string) => Promise<void>;
  handleVerifyLoginTwoFactor: (
    event: FormEvent<HTMLFormElement>,
  ) => Promise<DemoUser | null>;
  logout: () => Promise<void>;
  setupTwoFactor: () => Promise<void>;
  verifyTwoFactor: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  disableTwoFactor: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  createSession?: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  checkoutWithImage?: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  completeSession: (id: string) => Promise<void>;
  approveCheckout: (id: string, plate: string) => Promise<void>;
  cameraEntry: (deviceId: string) => Promise<void>;
  cameraExit: (deviceId: string) => Promise<void>;
  updatePricing: (form: FormData) => Promise<boolean>;
  confirmTransaction: (id: string) => Promise<void>;
  createPaymentForSession: (id: string) => Promise<void>;
  saveDevice: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  snapshotDevice: (id: string) => Promise<void>;
  loadReportSummary: (from: string, to: string) => Promise<void>;
  downloadReport: (
    type: "sessions" | "revenue",
    format?: "xlsx" | "pdf",
  ) => Promise<void>;
  simulateAction: (message: string) => void;
  markNotificationRead: (id: string) => Promise<void>;
  startShift: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  endShift: (id: string) => Promise<void>;
  createIncident: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  resolveIncident: (id: string) => Promise<void>;
  approveVehicle: (vehicle: RegisteredVehicle) => Promise<void>;
  fetchVehicleDetail: (id: string) => Promise<RegisteredVehicle | null>;
  createEditRequest: (
    vehicleId: string,
    subscriptionId: string,
    changes: Partial<RegisteredVehicle>,
  ) => Promise<void>;
  createDeleteRequest: (
    vehicleId: string,
    subscriptionId: string,
  ) => Promise<void>;
  resolveRequest: (
    requestId: string,
    action: "approved" | "rejected",
    adminNote?: string,
  ) => Promise<void>;
  loadVehicleRequests: () => Promise<void>;
  loadVehicles: () => Promise<void>;
  addVehicle: (data: {
    plate: string;
    ownerName?: string;
    ownerPhone?: string;
    ownerAddress?: string;
    brand?: string;
    model?: string;
    color?: string;
    year?: number;
    engineNo?: string;
    chassisNo?: string;
    imageUrl?: string;
  }) => Promise<void>;
  editVehicle: (
    id: string,
    data: {
      plate?: string;
      ownerName?: string;
      ownerPhone?: string;
      ownerAddress?: string;
      brand?: string;
      model?: string;
      color?: string;
      year?: number;
      engineNo?: string;
      chassisNo?: string;
      status?: string;
      imageUrl?: string;
    },
  ) => Promise<void>;
  removeVehicle: (id: string) => Promise<void>;
  zoneList: Zone[];
  slotList: ParkingSlot[];
  createZone: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateZone: (id: string, updates: Partial<Zone>) => Promise<void>;
  deleteZone: (id: string) => Promise<void>;
  createSlot: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  bulkCreateSlots: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateSlotStatus: (
    id: string,
    status: SlotStatus,
    notes?: string,
  ) => Promise<void>;
  deleteSlot: (id: string) => Promise<void>;
  updateSlotAccessPolicy: (
    id: string,
    accessPolicy: SlotAccessPolicy,
  ) => Promise<void>;
  reloadSlots: () => Promise<void>;
  planList: SubscriptionPlan[];
  subscriptionList: Subscription[];
  setSubscriptionList: (
    items: Subscription[] | ((prev: Subscription[]) => Subscription[]),
  ) => void;
  createPlan: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updatePlan: (
    planId: string,
    body: {
      name?: string;
      description?: string;
      price?: number;
      maxVehicles?: number;
      isActive?: boolean;
    },
  ) => Promise<SubscriptionPlan | null>;
  deletePlan: (planId: string) => Promise<void>;
  purchaseSubscription: (
    planId: string,
    vehicleId: string,
  ) => Promise<{ subscription: Subscription; payos?: Record<string, unknown> }>;
  renewSubscription: (
    id: string,
  ) => Promise<{ subscription: Subscription; payos?: Record<string, unknown> }>;
  cancelSubscription: (id: string) => Promise<void>;
  createVehicle: (data: {
    plate: string;
    ownerName?: string;
    ownerPhone?: string;
    brand?: string;
    model?: string;
    color?: string;
    year?: number;
  }) => Promise<RegisteredVehicle>;
  revenueChart: RevenueChartPoint[];
  occupancyData: OccupancyHourPoint[];
  topCustomers: TopCustomer[];
  peakHours: PeakHourPoint[];
  loadRevenueChart: (
    from: string,
    to: string,
    groupBy?: string,
  ) => Promise<void>;
  loadOccupancyHourly: (from: string, to: string) => Promise<void>;
  loadTopCustomers: (from: string, to: string, limit?: number) => Promise<void>;
  loadPeakHours: (from: string, to: string) => Promise<void>;
  capacityConfig: CapacityConfig | null;
  capacityZones: CapacityZoneSummary[];
  capacityUsage: CapacityUsage | null;
  capacityHistory: CapacityChangeLog[];
  loadCapacityConfig: () => Promise<{
    config: CapacityConfig;
    zones: CapacityZoneSummary[];
  } | null>;
  loadCapacityUsage: () => Promise<CapacityUsage | null>;
  loadCapacityHistory: (params?: {
    entityType?: "global" | "zone";
    zoneId?: string;
    limit?: number;
  }) => Promise<CapacityChangeLog[]>;
  loadZoneSlots: (zoneId: string) => Promise<ZoneSlotsResponse | null>;
  zoneSlots: Record<string, ZoneSlotsResponse>;
  updateGlobalCapacity: (payload: {
    globalCapacity: number;
    reason?: string;
  }) => Promise<boolean>;
  updateZoneCapacity: (
    zoneId: string,
    payload: {
      capacity: number;
      walkInQuota: number;
      subscriberQuota: number;
      reason?: string;
    },
  ) => Promise<boolean>;
};

const ParkingAppContext = createContext<ParkingAppContextValue | null>(null);

export function ParkingAppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(createInitialState);

  const setMode = useCallback(
    (mode: AuthMode) => setState((s) => ({ ...s, mode })),
    [],
  );
  const setCurrentUser = useCallback(
    (currentUser: DemoUser | null) => setState((s) => ({ ...s, currentUser })),
    [],
  );
  const setSessions = useCallback(
    (
      sessions:
        | ParkingSession[]
        | ((items: ParkingSession[]) => ParkingSession[]),
    ) =>
      setState((s) => ({
        ...s,
        sessions:
          typeof sessions === "function" ? sessions(s.sessions) : sessions,
      })),
    [],
  );
  const setRegisteredVehicles = useCallback(
    (
      registeredVehicles:
        | RegisteredVehicle[]
        | ((items: RegisteredVehicle[]) => RegisteredVehicle[]),
    ) =>
      setState((s) => ({
        ...s,
        registeredVehicles:
          typeof registeredVehicles === "function"
            ? registeredVehicles(s.registeredVehicles)
            : registeredVehicles,
      })),
    [],
  );
  const setVehicleRequests = useCallback(
    (
      vehicleRequests:
        | VehicleRequest[]
        | ((prev: VehicleRequest[]) => VehicleRequest[]),
    ) =>
      setState((s) => ({
        ...s,
        vehicleRequests:
          typeof vehicleRequests === "function"
            ? vehicleRequests(s.vehicleRequests)
            : vehicleRequests,
      })),
    [],
  );
  const setUserList = useCallback(
    (userList: DemoUser[] | ((items: DemoUser[]) => DemoUser[])) =>
      setState((s) => ({
        ...s,
        userList:
          typeof userList === "function" ? userList(s.userList) : userList,
      })),
    [],
  );
  const setSearchText = useCallback(
    (searchText: string) => setState((s) => ({ ...s, searchText })),
    [],
  );
  const setAuthError = useCallback(
    (authError: string) => setState((s) => ({ ...s, authError })),
    [],
  );
  const setMobileNavOpen = useCallback(
    (mobileNavOpen: boolean) => setState((s) => ({ ...s, mobileNavOpen })),
    [],
  );
  const setActionLog = useCallback(
    (actionLog: string) => setState((s) => ({ ...s, actionLog })),
    [],
  );
  const setExitSessionId = useCallback(
    (exitSessionId: string) => setState((s) => ({ ...s, exitSessionId })),
    [],
  );
  const setPricingConfigState = useCallback(
    (pricingConfigState: PricingConfig) =>
      setState((s) => ({ ...s, pricingConfigState })),
    [],
  );
  const setTransactionList = useCallback(
    (
      transactionList:
        | TransactionItem[]
        | ((items: TransactionItem[]) => TransactionItem[]),
    ) =>
      setState((s) => ({
        ...s,
        transactionList:
          typeof transactionList === "function"
            ? transactionList(s.transactionList)
            : transactionList,
      })),
    [],
  );
  const setNotificationList = useCallback(
    (
      notificationList:
        | NotificationItem[]
        | ((items: NotificationItem[]) => NotificationItem[]),
    ) =>
      setState((s) => ({
        ...s,
        notificationList:
          typeof notificationList === "function"
            ? notificationList(s.notificationList)
            : notificationList,
      })),
    [],
  );
  const setDeviceList = useCallback(
    (deviceList: DeviceItem[] | ((items: DeviceItem[]) => DeviceItem[])) =>
      setState((s) => ({
        ...s,
        deviceList:
          typeof deviceList === "function"
            ? deviceList(s.deviceList)
            : deviceList,
      })),
    [],
  );
  const setShiftList = useCallback(
    (shiftList: ShiftItem[] | ((items: ShiftItem[]) => ShiftItem[])) =>
      setState((s) => ({
        ...s,
        shiftList:
          typeof shiftList === "function" ? shiftList(s.shiftList) : shiftList,
      })),
    [],
  );
  const setShiftScheduleList = useCallback(
    (
      shiftScheduleList:
        | ShiftScheduleItem[]
        | ((items: ShiftScheduleItem[]) => ShiftScheduleItem[]),
    ) =>
      setState((s) => ({
        ...s,
        shiftScheduleList:
          typeof shiftScheduleList === "function"
            ? shiftScheduleList(s.shiftScheduleList)
            : shiftScheduleList,
      })),
    [],
  );
  const setIncidentList = useCallback(
    (
      incidentList:
        | IncidentItem[]
        | ((items: IncidentItem[]) => IncidentItem[]),
    ) =>
      setState((s) => ({
        ...s,
        incidentList:
          typeof incidentList === "function"
            ? incidentList(s.incidentList)
            : incidentList,
      })),
    [],
  );
  const setCapacityConfig = useCallback(
    (capacityConfig: CapacityConfig | null) =>
      setState((s) => ({ ...s, capacityConfig })),
    [],
  );
  const setCapacityZones = useCallback(
    (
      capacityZones:
        | CapacityZoneSummary[]
        | ((items: CapacityZoneSummary[]) => CapacityZoneSummary[]),
    ) =>
      setState((s) => ({
        ...s,
        capacityZones:
          typeof capacityZones === "function"
            ? capacityZones(s.capacityZones)
            : capacityZones,
      })),
    [],
  );
  const setCapacityUsage = useCallback(
    (capacityUsage: CapacityUsage | null) =>
      setState((s) => ({ ...s, capacityUsage })),
    [],
  );
  const setCapacityHistory = useCallback(
    (
      capacityHistory:
        | CapacityChangeLog[]
        | ((items: CapacityChangeLog[]) => CapacityChangeLog[]),
    ) =>
      setState((s) => ({
        ...s,
        capacityHistory:
          typeof capacityHistory === "function"
            ? capacityHistory(s.capacityHistory)
            : capacityHistory,
      })),
    [],
  );
  const setZoneSlots = useCallback(
    (
      zoneIdOrUpdater:
        | string
        | ((
            prev: Record<string, ZoneSlotsResponse>,
          ) => Record<string, ZoneSlotsResponse>),
      data?: ZoneSlotsResponse | null,
    ) => {
      if (typeof zoneIdOrUpdater === "function") {
        setState((s) => ({
          ...s,
          zoneSlots: zoneIdOrUpdater(s.zoneSlots),
        }));
        return;
      }
      setState((s) => {
        const next = { ...s.zoneSlots };
        if (data === null || data === undefined) delete next[zoneIdOrUpdater];
        else next[zoneIdOrUpdater] = data;
        return { ...s, zoneSlots: next };
      });
    },
    [],
  );
  const setReportFrom = useCallback(
    (reportFrom: string) => setState((s) => ({ ...s, reportFrom })),
    [],
  );
  const setReportTo = useCallback(
    (reportTo: string) => setState((s) => ({ ...s, reportTo })),
    [],
  );
  const setReportSummary = useCallback(
    (reportSummary: ReportSummary | null) =>
      setState((s) => ({ ...s, reportSummary })),
    [],
  );
  const setSessionLoading = useCallback(
    (sessionLoading: boolean) => setState((s) => ({ ...s, sessionLoading })),
    [],
  );

  const setZoneList = useCallback(
    (zoneList: Zone[] | ((items: Zone[]) => Zone[])) =>
      setState((s) => ({
        ...s,
        zoneList:
          typeof zoneList === "function" ? zoneList(s.zoneList) : zoneList,
      })),
    [],
  );

  const setSlotList = useCallback(
    (slotList: ParkingSlot[] | ((items: ParkingSlot[]) => ParkingSlot[])) =>
      setState((s) => ({
        ...s,
        slotList:
          typeof slotList === "function" ? slotList(s.slotList) : slotList,
      })),
    [],
  );

  /**
   * Tải lại danh sách slot từ server.
   * Dùng sau checkin/checkout để UI phản ánh đúng slot được gán / nhả.
   */
  const reloadSlots = useCallback(async () => {
    try {
      const response = await apiFetch("/parking-slots", { method: "GET" });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.slots)) {
        setSlotList(data.slots);
      }
    } catch {
      // Bỏ qua lỗi mạng, action log riêng ở hook gọi
    }
  }, [setSlotList]);

  const setPlanList = useCallback(
    (
      planList:
        | SubscriptionPlan[]
        | ((items: SubscriptionPlan[]) => SubscriptionPlan[]),
    ) =>
      setState((s) => ({
        ...s,
        planList:
          typeof planList === "function" ? planList(s.planList) : planList,
      })),
    [],
  );

  const setSubscriptionList = useCallback(
    (
      subscriptionList:
        | Subscription[]
        | ((items: Subscription[]) => Subscription[]),
    ) =>
      setState((s) => ({
        ...s,
        subscriptionList:
          typeof subscriptionList === "function"
            ? subscriptionList(s.subscriptionList)
            : subscriptionList,
      })),
    [],
  );

  const setMaintenanceLogList = useCallback(
    (
      maintenanceLogList:
        | DeviceMaintenanceLog[]
        | ((items: DeviceMaintenanceLog[]) => DeviceMaintenanceLog[]),
    ) =>
      setState((s) => ({
        ...s,
        maintenanceLogList:
          typeof maintenanceLogList === "function"
            ? maintenanceLogList(s.maintenanceLogList)
            : maintenanceLogList,
      })),
    [],
  );

  const setRevenueChart = useCallback(
    (revenueChart: RevenueChartPoint[]) =>
      setState((s) => ({ ...s, revenueChart })),
    [],
  );
  const setOccupancyData = useCallback(
    (occupancyData: OccupancyHourPoint[]) =>
      setState((s) => ({ ...s, occupancyData })),
    [],
  );
  const setTopCustomers = useCallback(
    (topCustomers: TopCustomer[]) => setState((s) => ({ ...s, topCustomers })),
    [],
  );
  const setPeakHours = useCallback(
    (peakHours: PeakHourPoint[]) => setState((s) => ({ ...s, peakHours })),
    [],
  );

  useSessionLoader({ setCurrentUser, setActionLog, setSessionLoading });

  useOperationalData({
    currentUser: state.currentUser,
    setSessions,
    setRegisteredVehicles,
    setUserList,
    setPricingConfigState,
    setTransactionList,
    setNotificationList,
    setDeviceList,
    setShiftList,
    setShiftScheduleList,
    setIncidentList,
    setZoneList,
    setSlotList,
    setPlanList,
    setSubscriptionList,
    setActionLog,
  });

  useReportSummaryLoader({
    currentUser: state.currentUser,
    reportFrom: state.reportFrom,
    reportTo: state.reportTo,
    setReportSummary,
    setActionLog,
  });

  const authActions = useMemo(
    () =>
      createAuthActions({
        setMode,
        setCurrentUser,
        setAuthError,
        setActionLog,
      }),
    [setMode, setCurrentUser, setAuthError, setActionLog],
  );

  const sessionActions = useMemo(
    () =>
      createSessionActions({
        exitSessionId: state.exitSessionId,
        setSessions,
        setExitSessionId,
        setActionLog,
        reloadSlots,
      }),
    [
      state.exitSessionId,
      setSessions,
      setExitSessionId,
      setActionLog,
      reloadSlots,
    ],
  );

  const paymentActions = useMemo(
    () =>
      createPaymentActions({
        setSessions,
        setPricingConfigState,
        setTransactionList,
        setActionLog,
      }),
    [setSessions, setPricingConfigState, setTransactionList, setActionLog],
  );

  const reportActions = useMemo(
    () =>
      createReportActions({
        reportFrom: state.reportFrom,
        reportTo: state.reportTo,
        setReportSummary,
        setActionLog,
      }),
    [state.reportFrom, state.reportTo, setReportSummary, setActionLog],
  );

  const miscActions = useMemo(
    () =>
      createMiscActions({
        setNotificationList,
        setShiftList,
        setIncidentList,
        setRegisteredVehicles,
        setActionLog,
      }),
    [
      setNotificationList,
      setShiftList,
      setIncidentList,
      setRegisteredVehicles,
      setActionLog,
    ],
  );

  const vehicleActions = useMemo(
    () =>
      createVehicleActions({
        setRegisteredVehicles,
        setVehicleRequests,
        setActionLog,
      }),
    [setRegisteredVehicles, setVehicleRequests, setActionLog],
  );
  const zoneActions = useMemo(
    () => createZoneActions({ setZoneList, setActionLog }),
    [setZoneList, setActionLog],
  );

  const slotActions = useMemo(
    () => createSlotActions({ setSlotList, setActionLog }),
    [setSlotList, setActionLog],
  );

  /**
   * Auto-refresh slot mỗi 5s khi user đã đăng nhập.
   * Đảm bảo mọi tab (cameras / rfid / vehicles / dashboard) đều thấy
   * slot chuyển trạng thái realtime mà không cần mở trang parking-slots.
   * Dừng interval khi logout.
   */
  useEffect(() => {
    if (!state.currentUser) return;
    const interval = setInterval(() => {
      void reloadSlots();
    }, 5_000);
    return () => clearInterval(interval);
  }, [state.currentUser, reloadSlots]);

  const subscriptionActions = useMemo(
    () =>
      createSubscriptionActions({
        setPlanList,
        setSubscriptionList,
        setRegisteredVehicles,
        setActionLog,
      }),
    [setPlanList, setSubscriptionList, setRegisteredVehicles, setActionLog],
  );

  const analyticsActions = useMemo(
    () =>
      createAnalyticsActions({
        setRevenueChart,
        setOccupancyData,
        setTopCustomers,
        setPeakHours,
        setActionLog,
      }),
    [
      setRevenueChart,
      setOccupancyData,
      setTopCustomers,
      setPeakHours,
      setActionLog,
    ],
  );

  const userActions = useMemo(
    () => createUserActions({ setUserList, setActionLog }),
    [setUserList, setActionLog],
  );

  const shiftScheduleActions = useMemo(
    () =>
      createShiftScheduleActions({
        setScheduleList: setShiftScheduleList,
        setActionLog,
      }),
    [setShiftScheduleList, setActionLog],
  );

  const capacityActions = useMemo(
    () =>
      createCapacityActions({
        setCapacityConfig,
        setCapacityUsage,
        setCapacityHistory,
        setZoneSlots,
        setActionLog,
      }),
    [
      setCapacityConfig,
      setCapacityUsage,
      setCapacityHistory,
      setZoneSlots,
      setActionLog,
    ],
  );

  const stats = useMemo(() => {
    const active = state.sessions.filter(
      (item) => item.status === "Đang gửi",
    ).length;
    const totalSlots = state.slotList.length || 30;
    const emptySlots = state.slotList.filter(
      (s) => s.status === "empty",
    ).length;
    const revenue = state.sessions.reduce((sum, item) => sum + item.fee, 0);
    return {
      active,
      available: totalSlots > 0 ? emptySlots : totalSlots - active,
      revenue,
      completion: state.sessions.filter(
        (item) => item.status === "Đã hoàn thành",
      ).length,
    };
  }, [state.sessions, state.slotList]);

  const filteredSessions = useMemo(() => {
    return state.sessions.filter((session) => {
      const value =
        `${session.plate} ${session.owner} ${session.id}`.toLowerCase();
      return value.includes(state.searchText.toLowerCase());
    });
  }, [state.sessions, state.searchText]);

  const value = useMemo<ParkingAppContextValue>(
    () => ({
      mode: state.mode,
      setMode,
      currentUser: state.currentUser,
      setCurrentUser,
      sessions: state.sessions,
      setSessions,
      registeredVehicles: state.registeredVehicles,
      setRegisteredVehicles,
      vehicleRequests: state.vehicleRequests,
      setVehicleRequests,
      userList: state.userList,
      searchText: state.searchText,
      setSearchText,
      authError: state.authError,
      mobileNavOpen: state.mobileNavOpen,
      setMobileNavOpen,
      actionLog: state.actionLog,
      setActionLog,
      exitSessionId: state.exitSessionId,
      setExitSessionId,
      pricingConfigState: state.pricingConfigState,
      transactionList: state.transactionList,
      setTransactionList,
      notificationList: state.notificationList,
      deviceList: state.deviceList,
      shiftList: state.shiftList,
      shiftScheduleList: state.shiftScheduleList,
      incidentList: state.incidentList,
      reportFrom: state.reportFrom,
      setReportFrom,
      reportTo: state.reportTo,
      setReportTo,
      reportSummary: state.reportSummary,
      sessionLoading: state.sessionLoading,
      stats,
      filteredSessions,
      ...authActions,
      ...sessionActions,
      ...paymentActions,
      ...reportActions,
      ...miscActions,
      ...vehicleActions,
      zoneList: state.zoneList,
      slotList: state.slotList,
      ...zoneActions,
      ...slotActions,
      reloadSlots,
      planList: state.planList,
      subscriptionList: state.subscriptionList,
      setSubscriptionList,
      ...subscriptionActions,
      revenueChart: state.revenueChart,
      occupancyData: state.occupancyData,
      topCustomers: state.topCustomers,
      peakHours: state.peakHours,
      ...analyticsActions,
      ...userActions,
      ...shiftScheduleActions,
      capacityConfig: state.capacityConfig,
      capacityZones: state.capacityZones,
      capacityUsage: state.capacityUsage,
      capacityHistory: state.capacityHistory,
      zoneSlots: state.zoneSlots,
      loadCapacityConfig: async () => {
        const result = await capacityActions.loadConfig();
        if (!result) return null;
        setCapacityZones(result.zones ?? []);
        return result;
      },
      loadCapacityUsage: capacityActions.loadUsage,
      loadCapacityHistory: capacityActions.loadHistory,
      loadZoneSlots: capacityActions.loadZoneSlots,
      updateGlobalCapacity: async (payload) => {
        const ok = await capacityActions.updateGlobalCapacity(payload);
        if (ok) await capacityActions.loadUsage();
        return ok;
      },
      updateZoneCapacity: async (zoneId, payload) => {
        const ok = await capacityActions.updateZoneCapacity(zoneId, payload);
        if (ok) {
          await capacityActions.loadUsage();
          const refreshed = await capacityActions.loadConfig();
          if (refreshed) setCapacityZones(refreshed.zones ?? []);
          await capacityActions.loadZoneSlots(zoneId);
        }
        return ok;
      },
    }),
    [
      state,
      stats,
      filteredSessions,
      authActions,
      sessionActions,
      paymentActions,
      reportActions,
      miscActions,
      zoneActions,
      slotActions,
      subscriptionActions,
      analyticsActions,
      userActions,
      shiftScheduleActions,
      capacityActions,
    ],
  );

  return (
    <ParkingAppContext.Provider value={value}>
      {children}
    </ParkingAppContext.Provider>
  );
}

export function useParkingApp() {
  const context = useContext(ParkingAppContext);
  if (!context) {
    throw new Error("useParkingApp must be used within ParkingAppProvider");
  }
  return context;
}
