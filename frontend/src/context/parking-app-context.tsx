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
import { createAuthActions } from "@/hooks/actions/use-auth-actions";
import { createDeviceActions } from "@/hooks/actions/use-device-actions";
import { createMiscActions } from "@/hooks/actions/use-misc-actions";
import { createPaymentActions } from "@/hooks/actions/use-payment-actions";
import {
  createReportActions,
  useReportSummaryLoader,
} from "@/hooks/actions/use-report-actions";
import { createSessionActions } from "@/hooks/actions/use-session-actions";
import { createZoneActions } from "@/hooks/actions/use-zone-actions";
import { useOperationalData } from "@/hooks/use-operational-data";
import { useSessionLoader } from "@/hooks/use-session-loader";
import { parkingConfig } from "@/lib/parking-config";
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
  Zone,
} from "@/types";
import type { FormEvent } from "react";

type ParkingAppContextValue = {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  currentUser: DemoUser | null;
  setCurrentUser: (user: DemoUser | null) => void;
  sessions: ParkingSession[];
  registeredVehicles: RegisteredVehicle[];
  userList: DemoUser[];
  searchText: string;
  setSearchText: (text: string) => void;
  authError: string;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  actionLog: string;
  exitSessionId: string;
  setExitSessionId: (id: string) => void;
  pricingConfigState: PricingConfig;
  paymentConfigState: PaymentConfig;
  transactionList: TransactionItem[];
  notificationList: NotificationItem[];
  feedbackList: FeedbackItem[];
  deviceList: DeviceItem[];
  shiftList: ShiftItem[];
  incidentList: IncidentItem[];
  zoneList: Zone[];
  twoFactorQr: string;
  reportFrom: string;
  setReportFrom: (from: string) => void;
  reportTo: string;
  setReportTo: (to: string) => void;
  reportSummary: ReportSummary | null;
  sessionLoading: boolean;
  membershipActive: boolean;
  membershipExpiresAt: string;
  stats: {
    active: number;
    available: number;
    revenue: number;
    completion: number;
  };
  filteredSessions: ParkingSession[];
  handleLogin: (event: FormEvent<HTMLFormElement>) => Promise<DemoUser | null>;
  handleRegister: (
    event: FormEvent<HTMLFormElement>,
  ) => Promise<DemoUser | null>;
  handleForgotPassword: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  logout: () => Promise<void>;
  setupTwoFactor: () => Promise<void>;
  verifyTwoFactor: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  disableTwoFactor: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  createSession: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  checkoutWithImage: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  completeSession: (id: string) => Promise<void>;
  approveCheckout: (id: string, plate: string) => Promise<void>;
  cameraEntry: (deviceId: string) => Promise<void>;
  cameraExit: (deviceId: string) => Promise<void>;
  updatePricing: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updatePaymentConfig: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  confirmTransaction: (id: string) => Promise<void>;
  createPaymentForSession: (id: string) => Promise<void>;
  topUpWallet: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  payWithWallet: (transactionId: string) => Promise<void>;
  purchaseParkingPackage: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  activateMembership: () => void;
  paymentStatusLabel: (status: TransactionItem["status"]) => string;
  saveDevice: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  snapshotDevice: (id: string) => Promise<void>;
  loadReportSummary: (from: string, to: string) => Promise<void>;
  downloadReport: (
    type: "sessions" | "revenue",
    format?: "xlsx" | "pdf",
  ) => Promise<void>;
  simulateAction: (message: string) => void;
  createFeedback: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateFeedbackStatus: (id: string) => Promise<void>;
  createZone: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateZone: (id: string, updates: Partial<Zone>) => Promise<void>;
  deleteZone: (id: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  startShift: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  endShift: (id: string) => Promise<void>;
  createIncident: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  resolveIncident: (id: string) => Promise<void>;
  approveVehicle: (vehicle: RegisteredVehicle) => Promise<void>;
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
  const setUserList = useCallback(
    (userList: DemoUser[]) => setState((s) => ({ ...s, userList })),
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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const setExitSessionId = useCallback(
    (exitSessionId: string) => setState((s) => ({ ...s, exitSessionId })),
    [],
  );
  const setPricingConfigState = useCallback(
    (pricingConfigState: PricingConfig) =>
      setState((s) => ({ ...s, pricingConfigState })),
    [],
  );
  const setPaymentConfigState = useCallback(
    (paymentConfigState: PaymentConfig) =>
      setState((s) => ({ ...s, paymentConfigState })),
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
  const setFeedbackList = useCallback(
    (
      feedbackList:
        | FeedbackItem[]
        | ((items: FeedbackItem[]) => FeedbackItem[]),
    ) =>
      setState((s) => ({
        ...s,
        feedbackList:
          typeof feedbackList === "function"
            ? feedbackList(s.feedbackList)
            : feedbackList,
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
  const setZoneList = useCallback(
    (zoneList: Zone[] | ((items: Zone[]) => Zone[])) =>
      setState((s) => ({
        ...s,
        zoneList:
          typeof zoneList === "function" ? zoneList(s.zoneList) : zoneList,
      })),
    [],
  );
  const setTwoFactorQr = useCallback(
    (twoFactorQr: string) => setState((s) => ({ ...s, twoFactorQr })),
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
  const setMembershipActive = useCallback(
    (membershipActive: boolean) =>
      setState((s) => ({ ...s, membershipActive })),
    [],
  );
  const setMembershipExpiresAt = useCallback(
    (membershipExpiresAt: string) =>
      setState((s) => ({ ...s, membershipExpiresAt })),
    [],
  );

  useSessionLoader({ setCurrentUser, setActionLog, setSessionLoading });

  useEffect(() => {
    if (state.currentUser) {
      window.localStorage.setItem("ipark_current_user", JSON.stringify(state.currentUser));
    } else {
      window.localStorage.removeItem("ipark_current_user");
    }
  }, [state.currentUser]);

  useOperationalData({
    currentUser: state.currentUser,
    setSessions,
    setRegisteredVehicles,
    setUserList,
    setPricingConfigState,
    setPaymentConfigState,
    setTransactionList,
    setNotificationList,
    setFeedbackList,
    setDeviceList,
    setShiftList,
    setIncidentList,
    setZoneList,
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
        setTwoFactorQr,
      }),
    [setMode, setCurrentUser, setAuthError, setActionLog, setTwoFactorQr],
  );

  const sessionActions = useMemo(
    () =>
      createSessionActions({
        exitSessionId: state.exitSessionId,
        setSessions,
        setExitSessionId,
        setActionLog,
      }),
    [state.exitSessionId, setSessions, setExitSessionId, setActionLog],
  );

  const paymentActions = useMemo(
    () =>
      createPaymentActions({
        currentUser: state.currentUser,
        setCurrentUser,
        pricingConfigState: state.pricingConfigState,
        setPricingConfigState,
        setPaymentConfigState,
        setTransactionList,
        transactionList: state.transactionList,
        setMembershipActive,
        setMembershipExpiresAt,
        setActionLog,
      }),
    [
      state.currentUser,
      state.pricingConfigState,
      state.transactionList,
      setCurrentUser,
      setPricingConfigState,
      setPaymentConfigState,
      setTransactionList,
      setMembershipActive,
      setMembershipExpiresAt,
      setActionLog,
    ],
  );

  const deviceActions = useMemo(
    () =>
      createDeviceActions({
        setDeviceList,
        setActionLog,
      }),
    [setDeviceList, setActionLog],
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
        setFeedbackList,
        setNotificationList,
        setShiftList,
        setIncidentList,
        setRegisteredVehicles,
        setActionLog,
      }),
    [
      setFeedbackList,
      setNotificationList,
      setShiftList,
      setIncidentList,
      setRegisteredVehicles,
      setActionLog,
    ],
  );

  const zoneActions = useMemo(
    () => createZoneActions({ setZoneList, setActionLog, onServerError: setFormErrors }),
    [setZoneList, setActionLog, setFormErrors],
  );

  const stats = useMemo(() => {
    const active = state.sessions.filter(
      (item) => item.status === "Đang gửi",
    ).length;
    const revenue = state.sessions.reduce((sum, item) => sum + item.fee, 0);

    return {
      active,
      available: parkingConfig.totalCapacity - active,
      revenue,
      completion: state.sessions.filter(
        (item) => item.status === "Đã hoàn thành",
      ).length,
    };
  }, [state.sessions]);

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
      registeredVehicles: state.registeredVehicles,
      userList: state.userList,
      searchText: state.searchText,
      setSearchText,
      authError: state.authError,
      mobileNavOpen: state.mobileNavOpen,
      setMobileNavOpen,
      actionLog: state.actionLog,
      exitSessionId: state.exitSessionId,
      setExitSessionId,
      pricingConfigState: state.pricingConfigState,
      paymentConfigState: state.paymentConfigState,
      transactionList: state.transactionList,
      notificationList: state.notificationList,
      feedbackList: state.feedbackList,
      deviceList: state.deviceList,
      shiftList: state.shiftList,
      incidentList: state.incidentList,
      zoneList: state.zoneList,
      twoFactorQr: state.twoFactorQr,
      reportFrom: state.reportFrom,
      setReportFrom,
      reportTo: state.reportTo,
      setReportTo,
      reportSummary: state.reportSummary,
      sessionLoading: state.sessionLoading,
      membershipActive: state.membershipActive,
      membershipExpiresAt: state.membershipExpiresAt,
      stats,
      filteredSessions,
      formErrors,
      setFormErrors,
      ...authActions,
      ...sessionActions,
      ...paymentActions,
      ...deviceActions,
      ...reportActions,
      ...miscActions,
      ...zoneActions,
    }),
    [
      state,
      stats,
      filteredSessions,
      authActions,
      sessionActions,
      paymentActions,
      deviceActions,
      reportActions,
      miscActions,
      zoneActions,
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
