import { useEffect, useRef } from "react";

import { apiFetch } from "@/lib/client-api";
import type {
  DemoUser,
  DeviceItem,
  FeedbackItem,
  IncidentItem,
  NotificationItem,
  ParkingSession,
  PaymentConfig,
  PricingConfig,
  RegisteredVehicle,
  ShiftItem,
  TransactionItem,
} from "@/types";

type OperationalDataParams = {
  currentUser: DemoUser | null;
  setSessions: (sessions: ParkingSession[] | ((items: ParkingSession[]) => ParkingSession[])) => void;
  setRegisteredVehicles: (
    vehicles: RegisteredVehicle[] | ((items: RegisteredVehicle[]) => RegisteredVehicle[]),
  ) => void;
  setUserList: (users: DemoUser[]) => void;
  setPricingConfigState: (config: PricingConfig) => void;
  setPaymentConfigState: (config: PaymentConfig) => void;
  setTransactionList: (
    transactions: TransactionItem[] | ((items: TransactionItem[]) => TransactionItem[]),
  ) => void;
  setNotificationList: (
    notifications: NotificationItem[] | ((items: NotificationItem[]) => NotificationItem[]),
  ) => void;
  setFeedbackList: (feedback: FeedbackItem[] | ((items: FeedbackItem[]) => FeedbackItem[])) => void;
  setDeviceList: (devices: DeviceItem[] | ((items: DeviceItem[]) => DeviceItem[])) => void;
  setShiftList: (shifts: ShiftItem[] | ((items: ShiftItem[]) => ShiftItem[])) => void;
  setIncidentList: (incidents: IncidentItem[] | ((items: IncidentItem[]) => IncidentItem[])) => void;
  setActionLog: (log: string) => void;
};

export function useOperationalData({
  currentUser,
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
  setActionLog,
}: OperationalDataParams) {
  const loadedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      loadedForUserRef.current = null;
      return;
    }

    const loadKey = `${currentUser.id}:${currentUser.role}`;
    if (loadedForUserRef.current === loadKey) {
      return;
    }
    loadedForUserRef.current = loadKey;

    const activeUser = currentUser;
    let cancelled = false;

    async function loadOperationalData() {
      try {
        const [sessionResponse, vehicleResponse] = await Promise.all([
          apiFetch("/parking-sessions"),
          apiFetch("/vehicles"),
        ]);
        if (cancelled) {
          return;
        }
        if (sessionResponse.ok) {
          const data = await sessionResponse.json();
          setSessions(data.sessions);
        }
        if (vehicleResponse.ok) {
          const data = await vehicleResponse.json();
          setRegisteredVehicles(data.vehicles);
        }
        if (activeUser.role === "admin") {
          const userResponse = await apiFetch("/users");
          if (!cancelled && userResponse.ok) {
            const data = await userResponse.json();
            setUserList(data.users);
          }
        }
        const pricingResponse = await apiFetch("/pricing-config");
        if (!cancelled && pricingResponse.ok) {
          const data = await pricingResponse.json();
          setPricingConfigState(data.pricingConfig);
        }
        const [paymentResponse, transactionResponse, notificationResponse, feedbackResponse] = await Promise.all([
          apiFetch("/payment-config"),
          apiFetch("/transactions"),
          apiFetch("/notifications"),
          apiFetch("/feedback"),
        ]);
        if (cancelled) {
          return;
        }
        if (paymentResponse.ok) {
          const data = await paymentResponse.json();
          setPaymentConfigState(data.paymentConfig);
        }
        if (transactionResponse.ok) {
          const data = await transactionResponse.json();
          setTransactionList(data.transactions);
        }
        if (notificationResponse.ok) {
          const data = await notificationResponse.json();
          setNotificationList(data.notifications);
        }
        if (feedbackResponse.ok) {
          const data = await feedbackResponse.json();
          setFeedbackList(data.feedback);
        }
        if (activeUser.role !== "customer") {
          const [deviceResponse, shiftResponse, incidentResponse] = await Promise.all([
            apiFetch("/devices"),
            apiFetch("/shifts"),
            apiFetch("/incidents"),
          ]);
          if (cancelled) {
            return;
          }
          if (deviceResponse.ok) {
            const data = await deviceResponse.json();
            setDeviceList(data.devices);
          }
          if (shiftResponse.ok) {
            const data = await shiftResponse.json();
            setShiftList(data.shifts);
          }
          if (incidentResponse.ok) {
            const data = await incidentResponse.json();
            setIncidentList(data.incidents);
          }
        }
      } catch {
        if (!cancelled) {
          setActionLog("Không tải được dữ liệu vận hành từ MongoDB local.");
        }
      }
    }

    loadOperationalData();

    return () => {
      cancelled = true;
    };
  }, [
    currentUser?.id,
    currentUser?.role,
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
    setActionLog,
  ]);
}
