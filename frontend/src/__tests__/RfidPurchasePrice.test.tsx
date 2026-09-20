import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { apiFetch } from "@/lib/client-api";
import { CustomerRfidRegistrationView } from "@/features/rfid/customer-rfid-registration-view";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/context/parking-app-context", () => ({
  useParkingApp: () => ({
    registeredVehicles: [{ id: "vehicle-1", plate: "30A12345", status: "Đã đăng ký" }],
    subscriptionList: [],
  }),
}));
jest.mock("@/features/rfid/member-rfid-issue-panel", () => ({ MemberRfidIssuePanel: () => null }));
jest.mock("@/lib/client-api", () => ({ apiFetch: jest.fn() }));

describe("RFID purchase price", () => {
  let price: number;
  let priceAvailable: boolean;

  beforeEach(() => {
    jest.useFakeTimers();
    price = 50000;
    priceAvailable = true;
    jest.mocked(apiFetch).mockImplementation(async (path) => ({
      ok: path !== "/pricing-config" || priceAvailable,
      json: async () => path === "/pricing-config"
        ? { pricingConfig: { rfidCardSalePrice: price } }
        : { cards: [], requests: [] },
    } as Response));
  });

  afterEach(() => { jest.useRealTimers(); });

  it("loads the price and refreshes it on the next poll and window focus", async () => {
    const view = render(<CustomerRfidRegistrationView />);
    await act(async () => {});
    expect(screen.getByText(/Giá thẻ RFID: 50.000 VND/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mua thẻ ngay" })).toBeEnabled();

    price = 60000;
    await act(async () => { jest.advanceTimersByTime(10000); });
    expect(screen.getByText(/Giá thẻ RFID: 60.000 VND/)).toBeInTheDocument();

    price = 70000;
    await act(async () => { fireEvent(window, new Event("focus")); });
    expect(screen.getByText(/Giá thẻ RFID: 70.000 VND/)).toBeInTheDocument();
    view.unmount();
    const callsAfterUnmount = jest.mocked(apiFetch).mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(10000);
      fireEvent(window, new Event("focus"));
    });
    expect(jest.mocked(apiFetch).mock.calls.length).toBe(callsAfterUnmount);
  });

  it("disables purchase when the current price cannot be loaded and recovers", async () => {
    priceAvailable = false;
    render(<CustomerRfidRegistrationView />);
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Mua thẻ ngay" })).toBeDisabled();
    expect(screen.getByText(/Chưa tải được giá thẻ RFID/)).toBeInTheDocument();

    priceAvailable = true;
    await act(async () => { jest.advanceTimersByTime(10000); });
    expect(screen.getByRole("button", { name: "Mua thẻ ngay" })).toBeEnabled();
  });
});
