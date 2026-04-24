import { useMemo, useState } from "react";
import { X, Check, Plus, Minus, Star } from "lucide-react";
import { MenuItem, SizeOption, AddOnOption, storeInfo } from "@/data/menu";
import { computeUnitPrice } from "@/hooks/useCart";

interface ProductCustomizeModalProps {
  open: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (item: MenuItem, qty: number, size?: SizeOption, addOns?: AddOnOption[]) => void;
}

/**
 * Bottom-sheet modal letting the customer pick a size + sauces/add-ons
 * before adding to cart. Driven by `item.has_sizes`/`item.has_add_ons`
 * which the admin configures in AdminMenuManager.
 */
const ProductCustomizeModal = ({ open, item, onClose, onAdd }: ProductCustomizeModalProps) => {
  const sizes = useMemo<SizeOption[]>(
    () => (Array.isArray(item?.sizes) ? item!.sizes : []),
    [item]
  );
  const addOns = useMemo<AddOnOption[]>(
    () => (Array.isArray(item?.add_ons) ? item!.add_ons : []),
    [item]
  );
  const hasSizes = !!item?.has_sizes && sizes.length > 0;
  const hasAddOns = !!item?.has_add_ons && addOns.length > 0;
  // If only one sauce is allowed, behave as radio; else checkboxes (capped).
  const maxAddOns = item?.max_add_ons && item.max_add_ons > 0 ? item.max_add_ons : 99;

  const defaultSize = useMemo(
    () => sizes.find(s => s.popular) || sizes[0],
    [sizes]
  );

  const [selectedSize, setSelectedSize] = useState<SizeOption | undefined>(defaultSize);
  const [selectedAddOns, setSelectedAddOns] = useState<AddOnOption[]>([]);
  const [qty, setQty] = useState(1);
  const [showSizeError, setShowSizeError] = useState(false);

  // Reset state whenever the modal opens with a new item
  useMemo(() => {
    if (open && item) {
      setSelectedSize(sizes.find(s => s.popular) || sizes[0]);
      setSelectedAddOns([]);
      setQty(1);
      setShowSizeError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  if (!open || !item) return null;

  const toggleAddOn = (a: AddOnOption) => {
    const isSelected = selectedAddOns.some(x => x.name === a.name);
    if (isSelected) {
      setSelectedAddOns(selectedAddOns.filter(x => x.name !== a.name));
    } else if (maxAddOns === 1) {
      setSelectedAddOns([a]); // radio behavior
    } else if (selectedAddOns.length < maxAddOns) {
      setSelectedAddOns([...selectedAddOns, a]);
    }
  };

  const unitPrice = computeUnitPrice(item, hasSizes ? selectedSize : undefined, selectedAddOns);
  const lineTotal = unitPrice * qty;

  const handleAdd = () => {
    if (hasSizes && !selectedSize) {
      setShowSizeError(true);
      return;
    }
    onAdd(
      item,
      qty,
      hasSizes ? selectedSize : undefined,
      selectedAddOns.length > 0 ? selectedAddOns : undefined
    );
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[92vh] flex-col rounded-t-3xl border-t border-border bg-background shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* Drag handle */}
        <div className="flex items-center justify-center pt-2 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-muted" />
        </div>

        {/* Header image */}
        <div className="relative">
          {item.image ? (
            <div className="h-44 w-full overflow-hidden bg-muted">
              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center bg-muted text-5xl">🍽️</div>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 rounded-full bg-background/90 p-2 shadow-card backdrop-blur-sm"
          >
            <X className="h-4 w-4 text-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h2 className="font-display text-xl font-bold text-foreground">{item.name}</h2>
          {item.caption && (
            <p className="mt-1 text-sm text-muted-foreground">{item.caption}</p>
          )}
          <p className="mt-2 font-display text-lg font-bold text-primary">
            From {storeInfo.currency}
            {(hasSizes ? Number(sizes[0].price) : Number(item.price)).toFixed(0)}
          </p>

          {/* SIZES */}
          {hasSizes && (
            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Choose a size
                </h3>
                <span className="text-[10px] font-bold uppercase text-destructive">
                  Required
                </span>
              </div>
              <div className="space-y-2">
                {sizes.map((s, i) => {
                  const checked = selectedSize?.name === s.name;
                  return (
                    <label
                      key={`${s.name}-${i}`}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-3 transition-all ${
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            checked
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40 bg-card"
                          }`}
                        >
                          {checked && (
                            <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {s.name}
                            </p>
                            {s.popular && (
                              <span className="flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                                <Star className="h-2.5 w-2.5 fill-primary" /> Popular
                              </span>
                            )}
                          </div>
                          {s.description && (
                            <p className="truncate text-xs text-muted-foreground">
                              {s.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="ml-2 flex-shrink-0 font-display text-sm font-bold text-primary">
                        {storeInfo.currency}
                        {Number(s.price).toFixed(0)}
                      </span>
                      <input
                        type="radio"
                        name="size"
                        className="sr-only"
                        checked={checked}
                        onChange={() => {
                          setSelectedSize(s);
                          setShowSizeError(false);
                        }}
                      />
                    </label>
                  );
                })}
              </div>
              {showSizeError && (
                <p className="mt-2 text-xs font-semibold text-destructive">
                  Please select a size to continue.
                </p>
              )}
            </section>
          )}

          {/* SAUCES / ADD-ONS */}
          {hasAddOns && (
            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {maxAddOns === 1 ? "Choose a sauce" : "Add sauces / extras"}
                </h3>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {maxAddOns === 1
                    ? "Pick one"
                    : `Pick up to ${Math.min(maxAddOns, addOns.length)}`}
                </span>
              </div>
              <div className="space-y-2">
                {addOns.map((a, i) => {
                  const checked = selectedAddOns.some(x => x.name === a.name);
                  const reachedCap =
                    !checked && maxAddOns > 1 && selectedAddOns.length >= maxAddOns;
                  const isFree = Number(a.price) === 0;
                  return (
                    <label
                      key={`${a.name}-${i}`}
                      className={`flex items-center justify-between rounded-xl border-2 p-3 transition-all ${
                        checked
                          ? "border-primary bg-primary/5"
                          : reachedCap
                          ? "border-border bg-card opacity-50 cursor-not-allowed"
                          : "border-border bg-card cursor-pointer hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                            checked
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40 bg-card"
                          }`}
                        >
                          {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                        </span>
                        <p className="truncate text-sm font-semibold text-foreground">
                          {a.name}
                        </p>
                      </div>
                      <span
                        className={`ml-2 flex-shrink-0 text-xs font-bold ${
                          isFree ? "text-success" : "text-primary"
                        }`}
                      >
                        {isFree ? "FREE" : `+${storeInfo.currency}${Number(a.price).toFixed(0)}`}
                      </span>
                      <input
                        type={maxAddOns === 1 ? "radio" : "checkbox"}
                        name="addon"
                        className="sr-only"
                        checked={checked}
                        disabled={reachedCap}
                        onChange={() => !reachedCap && toggleAddOn(a)}
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {/* Quantity stepper */}
          <section className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Quantity</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                aria-label="Decrease quantity"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                disabled={qty <= 1}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center font-display text-base font-bold text-foreground">
                {qty}
              </span>
              <button
                onClick={() => setQty(qty + 1)}
                aria-label="Increase quantity"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* Spacer so footer doesn't overlap last item */}
          <div className="h-2" />
        </div>

        {/* Sticky footer CTA */}
        <div className="border-t border-border bg-background/95 px-5 py-4 backdrop-blur-sm">
          <button
            onClick={handleAdd}
            disabled={hasSizes && !selectedSize}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-primary px-5 py-3.5 font-display text-sm font-bold text-primary-foreground shadow-orange transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add {qty} to cart
            </span>
            <span>
              {storeInfo.currency}
              {lineTotal.toFixed(2)}
            </span>
          </button>
        </div>
      </div>
    </>
  );
};

export default ProductCustomizeModal;
