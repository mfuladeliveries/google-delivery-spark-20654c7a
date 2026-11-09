import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CheckoutDialog from "@/components/CheckoutDialog";

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn(), Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useCustomerCredits", () => ({ useCustomerCredits: () => ({ balance: 0, refresh: vi.fn() }) }));
vi.mock("@/hooks/useCustomerLocation", () => ({ useCustomerLocation: () => ({ refresh: vi.fn(), zones: [] }) }));
vi.mock("@/hooks/useCustomerAddresses", () => ({ useCustomerAddresses: () => ({
  addresses: [], defaultAddress: { id: "old-home", address: "99 Old Street, Mfuleni", lat: -34, lng: 18.7 },
  add: vi.fn(), refresh: vi.fn(),
}) }));
vi.mock("@/components/AddressAutocomplete", () => ({ AddressAutocomplete: ({ value, onTextChange, hasValidSelection }: { value: string; onTextChange: (value: string) => void; hasValidSelection: boolean }) => <input aria-label="Delivery address" value={value} onChange={(e) => onTextChange(e.target.value)} data-verified={hasValidSelection} /> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) } }));

const props = { open: true, onClose: vi.fn(), items: [], subtotal: 160, tax: 8, delivery: 55, onOrderPlaced: vi.fn() };
const setHome = (address = "7 Ethos Way, Voorbrug, Cape Town") => sessionStorage.setItem("mfula-manual-area-v1", JSON.stringify({ address, lat: -33.976, lng: 18.644 }));

describe("checkout home address", () => {
  beforeEach(() => sessionStorage.clear());

  it("uses the initial home address instead of the default address book entry", async () => {
    setHome();
    render(<CheckoutDialog {...props} />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Delivery address" })).toHaveValue("7 Ethos Way, Voorbrug, Cape Town"));
    expect(screen.getByRole("textbox", { name: "Delivery address" })).toHaveAttribute("data-verified", "true");
  });

  it("preserves checkout edits and invalidates verification until reselected", () => {
    setHome();
    const { rerender } = render(<CheckoutDialog {...props} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Delivery address" }), { target: { value: "8 Different Street" } });
    rerender(<CheckoutDialog {...props} />);
    expect(screen.getByRole("textbox", { name: "Delivery address" })).toHaveValue("8 Different Street");
    expect(screen.getByRole("textbox", { name: "Delivery address" })).toHaveAttribute("data-verified", "false");
  });

  it("takes the latest home address on the next checkout opening", () => {
    setHome();
    const { rerender } = render(<CheckoutDialog {...props} />);
    rerender(<CheckoutDialog {...props} open={false} />);
    setHome("12A Oak Street, Mfuleni");
    rerender(<CheckoutDialog {...props} />);
    expect(screen.getByRole("textbox", { name: "Delivery address" })).toHaveValue("12A Oak Street, Mfuleni");
  });
});