import cors from "cors";
import express from "express";

type VehicleStatus = "verified" | "pending" | "blacklist";

type VehicleRecord = {
  id: string;
  plate: string;
  ownerName: string;
  ownerPhone?: string;
  vehicleType: "car";
  brand?: string;
  model?: string;
  color?: string;
  status: VehicleStatus;
  verifiedAt?: string;
  verificationNote?: string;
};

type GuestRfidCard = {
  id: string;
  code: string;
  plate: string;
  guestName: string;
  phone?: string;
  issuedAt: string;
  expiresAt: string;
  status: "active" | "returned";
  note?: string;
};

type ShiftItem = {
  id: string;
  name: string;
  staff: string;
  startAt: string;
  endAt: string;
  status: string;
  note: string;
};

const vehicles: VehicleRecord[] = [
  {
    id: "veh-001",
    plate: "30H67890",
    ownerName: "Nguyen Van A",
    ownerPhone: "0912345678",
    vehicleType: "car",
    brand: "Toyota",
    model: "Vios",
    color: "White",
    status: "verified",
    verifiedAt: new Date(Date.now() - 86400000).toISOString(),
    verificationNote: "Imported from source vehicle verification flow.",
  },
  {
    id: "veh-002",
    plate: "30E34567",
    ownerName: "Tran Thi B",
    ownerPhone: "0987654321",
    vehicleType: "car",
    brand: "Honda",
    model: "City",
    color: "Silver",
    status: "pending",
  },
];

const guestCards: GuestRfidCard[] = [
  {
    id: "card-001",
    code: "RFID-GUEST-1001",
    plate: "30H67890",
    guestName: "Le Minh",
    phone: "0900111222",
    issuedAt: new Date(Date.now() - 3600000).toISOString(),
    expiresAt: new Date(Date.now() + 23 * 3600000).toISOString(),
    status: "active",
    note: "Visitor parking card.",
  },
];

const shifts: ShiftItem[] = [
  {
    id: "shift-001",
    name: "Ca sang",
    staff: "nv.1@ipark.vn",
    startAt: "06:00",
    endAt: "14:00",
    status: "Dang lam",
    note: "Gate check-in and vehicle verification.",
  },
];

function normalizePlate(value: string) {
  return value.trim().toUpperCase().replace(/[\s.-]+/g, "");
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "ipark-backend" });
});

app.get("/api/shifts", (_request, response) => {
  response.json({ shifts });
});

app.post("/api/shifts", (request, response) => {
  const shift: ShiftItem = {
    id: createId("shift"),
    name: String(request.body?.name || "Ca moi"),
    staff: String(request.body?.staff || "Unassigned"),
    startAt: String(request.body?.startAt || "06:00"),
    endAt: String(request.body?.endAt || ""),
    status: "Dang lam",
    note: String(request.body?.note || ""),
  };
  shifts.unshift(shift);
  response.status(201).json({ shift });
});

app.patch("/api/shifts/:id/end", (request, response) => {
  const shift = shifts.find((item) => item.id === request.params.id);
  if (!shift) {
    response.status(404).json({ message: "Shift not found." });
    return;
  }
  shift.status = "Da ket thuc";
  shift.endAt = shift.endAt || new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  response.json({ shift });
});

app.get("/api/vehicles", (_request, response) => {
  response.json({ vehicles });
});

app.get("/api/vehicle-verification", (request, response) => {
  const plate = normalizePlate(String(request.query.plate || ""));
  if (!plate) {
    response.status(400).json({ message: "Plate is required." });
    return;
  }

  const vehicle = vehicles.find((item) => item.plate === plate);
  const activeCard = guestCards.find((card) => card.plate === plate && card.status === "active");

  response.json({
    plate,
    verified: vehicle?.status === "verified",
    status: vehicle?.status || "not_found",
    vehicle: vehicle || null,
    activeGuestCard: activeCard || null,
    message: vehicle
      ? vehicle.status === "blacklist"
        ? "Vehicle is blacklisted."
        : "Vehicle and plate information found."
      : "No vehicle record found for this plate.",
  });
});

app.post("/api/vehicles/verify", (request, response) => {
  const plate = normalizePlate(String(request.body?.plate || ""));
  if (!plate) {
    response.status(400).json({ message: "Plate is required." });
    return;
  }

  const existing = vehicles.find((item) => item.plate === plate);
  const payload = {
    ownerName: String(request.body?.ownerName || existing?.ownerName || "Guest vehicle"),
    ownerPhone: request.body?.ownerPhone ? String(request.body.ownerPhone) : existing?.ownerPhone,
    brand: request.body?.brand ? String(request.body.brand) : existing?.brand,
    model: request.body?.model ? String(request.body.model) : existing?.model,
    color: request.body?.color ? String(request.body.color) : existing?.color,
    verificationNote: request.body?.verificationNote ? String(request.body.verificationNote) : existing?.verificationNote,
  };

  if (existing) {
    Object.assign(existing, payload, {
      status: "verified" satisfies VehicleStatus,
      verifiedAt: new Date().toISOString(),
    });
    response.json({ vehicle: existing });
    return;
  }

  const vehicle: VehicleRecord = {
    id: createId("veh"),
    plate,
    vehicleType: "car",
    status: "verified",
    verifiedAt: new Date().toISOString(),
    ...payload,
  };
  vehicles.unshift(vehicle);
  response.status(201).json({ vehicle });
});

app.get("/api/rfid-cards/guest", (_request, response) => {
  response.json({ cards: guestCards });
});

app.post("/api/rfid-cards/guest", (request, response) => {
  const plate = normalizePlate(String(request.body?.plate || ""));
  const guestName = String(request.body?.guestName || "").trim();

  if (!plate || !guestName) {
    response.status(400).json({ message: "Plate and guest name are required." });
    return;
  }

  const vehicle = vehicles.find((item) => item.plate === plate);
  if (!vehicle || vehicle.status !== "verified") {
    response.status(409).json({ message: "Verify vehicle and plate information before issuing RFID." });
    return;
  }

  const activeCard = guestCards.find((card) => card.plate === plate && card.status === "active");
  if (activeCard) {
    response.status(409).json({ message: "This plate already has an active guest RFID card.", card: activeCard });
    return;
  }

  const issuedAt = new Date();
  const card: GuestRfidCard = {
    id: createId("card"),
    code: `RFID-GUEST-${Math.floor(1000 + Math.random() * 9000)}`,
    plate,
    guestName,
    phone: request.body?.phone ? String(request.body.phone) : undefined,
    issuedAt: issuedAt.toISOString(),
    expiresAt: addDays(issuedAt, 1).toISOString(),
    status: "active",
    note: request.body?.note ? String(request.body.note) : undefined,
  };

  guestCards.unshift(card);
  response.status(201).json({ card });
});
