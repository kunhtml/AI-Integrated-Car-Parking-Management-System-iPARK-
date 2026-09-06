import { useEffect, useRef } from "react";

import { apiFetch } from "@/lib/client-api";
import { logger } from "@/lib/logger";
import type {
  DemoUser,
  DeviceItem,
  NotificationItem,
  ParkingSession,
  ParkingSlot,
  PricingConfig,
  RegisteredVehicle,
  ShiftItem,
  ShiftScheduleItem,
  Subscription,
  SubscriptionPlan,
  TransactionItem,
  Zone,
} from "@/types";

type OperationalDataParams = {
  currentUser: DemoUser | null;
  setSessions: (
    sessions:
      | ParkingSession[]
      | ((items: ParkingSession[]) => ParkingSession[]),
  ) => void;
  setRegisteredVehicles: (
    vehicles:
      | RegisteredVehicle[]
      | ((items: RegisteredVehicle[]) => RegisteredVehicle[]),
  ) => void;
  setUserList: (
    users: DemoUser[] | ((items: DemoUser[]) => DemoUser[]),
  ) => void;
  setPricingConfigState: (config: PricingConfig) => void;
  setTransactionList: (
    transactions:
      | TransactionItem[]
      | ((items: TransactionItem[]) => TransactionItem[]),
  ) => void;
  setNotificationList: (
    notifications:
      | NotificationItem[]
      | ((items: NotificationItem[]) => NotificationItem[]),
  ) => void;
  setDeviceList: (
    devices: DeviceItem[] | ((items: DeviceItem[]) => DeviceItem[]),
  ) => void;
  setShiftList: (
    shifts: ShiftItem[] | ((items: ShiftItem[]) => ShiftItem[]),
  ) => void;
  setShiftScheduleList: (
    schedules:
      | ShiftScheduleItem[]
      | ((items: ShiftScheduleItem[]) => ShiftScheduleItem[]),
  ) => void;
  setZoneList: (zones: Zone[] | ((items: Zone[]) => Zone[])) => void;
  setSlotList: (
    slots: ParkingSlot[] | ((items: ParkingSlot[]) => ParkingSlot[]),
  ) => void;
  setPlanList: (
    items:
      | SubscriptionPlan[]
      | ((prev: SubscriptionPlan[]) => SubscriptionPlan[]),
  ) => void;
  setSubscriptionList: (
    items: Subscription[] | ((prev: Subscription[]) => Subscription[]),
  ) => void;
  setActionLog: (log: string) => void;
};

export function useOperationalData({
  currentUser,
  setSessions,
  setRegisteredVehicles,
  setUserList,
  setPricingConfigState,
  setTransactionList,
  setNotificationList,
  setDeviceList,
  setShiftList,
  setShiftScheduleList,
  setZoneList,
  setSlotList,
  setPlanList,
  setSubscriptionList,
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
        if (
          activeUser.role === "admin" ||
          activeUser.role === "manager" ||
          activeUser.role === "staff"
        ) {
          const users: DemoUser[] = [];
          let page = 1;
          let totalPages = 1;
          do {
            const userResponse = await apiFetch(
              `/users?page=${page}&limit=100`,
            );
            if (!userResponse.ok) break;
            const data = await userResponse.json();
            if (Array.isArray(data.users)) {
              users.push(...(data.users as DemoUser[]));
            }
            totalPages = Math.max(1, Number(data.totalPages) || 1);
            page += 1;
          } while (!cancelled && page <= totalPages);
          if (!cancelled) {
            setUserList(users);
          }
        }
        const pricingResponse = await apiFetch("/pricing-config");
        if (!cancelled && pricingResponse.ok) {
          const data = await pricingResponse.json();
          setPricingConfigState(data.pricingConfig);
        }
        const [transactionResponse, notificationResponse] = await Promise.all([
          apiFetch("/transactions"),
          apiFetch("/notifications"),
        ]);
        if (cancelled) {
          return;
        }
        if (transactionResponse.ok) {
          const data = await transactionResponse.json();
          setTransactionList(data.transactions);
        }
        if (notificationResponse.ok) {
          const data = await notificationResponse.json();
          setNotificationList(data.notifications);
        }
        if (activeUser.role !== "customer") {
          // Admin calls /shift-schedules (all schedules), Staff calls /shift-schedules/my (own schedule)
          const scheduleEndpoint =
            activeUser.role === "admin" || activeUser.role === "manager"
              ? "/shift-schedules"
              : "/shift-schedules/my";
          const [shiftResponse, shiftScheduleResponse] = await Promise.all([
            apiFetch("/shifts"),
            apiFetch(scheduleEndpoint),
          ]);
          if (cancelled) {
            return;
          }
          if (shiftResponse.ok) {
            const data = await shiftResponse.json();
            setShiftList(data.shifts);
          }
          if (shiftScheduleResponse.ok) {
            const data = await shiftScheduleResponse.json();
            setShiftScheduleList(data.schedules);
          }
          // Load zones and slots for admin/staff
          const [zoneResponse, slotResponse] = await Promise.all([
            apiFetch("/zones"),
            apiFetch("/parking-slots"),
          ]);
          if (cancelled) return;
          if (zoneResponse.ok) {
            const data = await zoneResponse.json();
            setZoneList(data.zones);
          }
          if (slotResponse.ok) {
            const data = await slotResponse.json();
            setSlotList(data.slots);
          }
        }
        // Load subscriptions for all roles
        const [plansRes, subsRes] = await Promise.all([
          apiFetch("/subscriptions/plans"),
          apiFetch(
            activeUser.role === "customer"
              ? "/subscriptions/my"
              : "/subscriptions",
          ),
        ]);
        if (cancelled) return;
        if (plansRes.ok) {
          const data = await plansRes.json();
          setPlanList(data.plans);
        }
        if (subsRes.ok) {
          const data = await subsRes.json();
          setSubscriptionList(data.subscriptions);
        }
      } catch (error) {
        if (!cancelled) {
          logger.error("[use-operational-data] Load error:", { error });
          setActionLog(
            "Lỗi tải dữ liệu. Kiểm tra console để biết thêm chi tiết.",
          );
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
    setTransactionList,
    setNotificationList,
    setDeviceList,
    setShiftList,
    setShiftScheduleList,
    setZoneList,
    setSlotList,
    setPlanList,
    setSubscriptionList,
    setActionLog,
  ]);
}
