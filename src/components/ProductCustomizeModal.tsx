import { useEffect, useMemo, useState } from "react";
import { X, Check, Plus, Minus, Star, Drumstick } from "lucide-react";
import { MenuItem, SizeOption, AddOnOption, CutOption, storeInfo } from "@/data/menu";
import { computeUnitPrice } from "@/hooks/useCart";

interface ProductCustomizeModalProps {
  open: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (
    item: MenuItem,
    qty: number,
    cut?: CutOption,
    size?: SizeOption,
    addOns?: AddOnOption[],
    pieces?: number,
  ) => void;
}

/**
 * Bottom-sheet modal letting the customer pick a cut + size + sauces/add-ons
 * before adding to cart. Driven by `item.has_cuts`/`has_sizes`/`has_add_ons`
 * which the admin configures in AdminMenuManager.
 */
const ProductCustomizeModal = ({ open, item, onClose, onAdd }: ProductCustomizeModalProps) => {
  const cuts = useMemo<CutOption[]>(() => (Array.isArray(item?.cuts) ? item!.cuts : []), [item]);
  const sizes = useMemo<SizeOption[]>(
    () => (Array.isArray(item?.sizes) ? item!.sizes : []),
    [item],
  );
  const addOns = useMemo<AddOnOption[]>(
    () => (Array.isArray(item?.add_ons) ? item!.add_ons : []),
    [item],
  );
  const hasCuts = !!item?.has_cuts && cuts.length > 0;
  const hasSizes = !!item?.has_sizes && sizes.length > 0;
  const hasAddOns = !!item?.has_add_ons && addOns.length > 0;
  const maxAddOns = item?.max_add_ons && item.max_add_ons > 0 ? item.max_add_ons : 99;

  const [selectedCut, setSelectedCut] = useState<CutOption | undefined>(undefined);
  const [selectedSize, setSelectedSize] = useState<SizeOption | undefined>(undefined);
  const [selectedAddOns, setSelectedAddOns] = useState<AddOnOption[]>([]);
  const [pieces, setPieces] = useState(1);
  const [qty, setQty] = useState(1);
  const [showCutError, setShowCutError] = useState(false);
  const [showSizeError, setShowSizeError] = useState(false);

  // Reset state whenever the modal opens with a new item
  useEffect(() => {
    if (open && item) {
      // Cuts have NO default — user must explicitly pick one (required).
      setSelectedCut(undefined);
      setSelectedSize(sizes.find((s) => s.popular) || sizes[0]);
      setSelectedAddOns([]);
      setPieces(1);
      setQty(1);
      setShowCutError(false);
      setShowSizeError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  // When the customer changes cut, snap pieces back into the cut's allowed range.
  useEffect(() => {
    if (!selectedCut) return;
    const min = Math.max(1, Number(selectedCut.min_pieces ?? 1));
    const max = Math.max(min, Number(selectedCut.max_pieces ?? 1));
    setPieces((p) => Math.min(Math.max(p, min), max));
  }, [selectedCut]);

  if (!open || !item) return null;

  const cutMin = Math.max(1, Number(selectedCut?.min_pieces ?? 1));
  const cutMax = Math.max(cutMin, Number(selectedCut?.max_pieces ?? 1));
  const showPiecesStepper = !!selectedCut && cutMax > 1;

  const toggleAddOn = (a: AddOnOption) => {
    const isSelected = selectedAddOns.some((x) => x.name === a.name);
    if (isSelected) {
      setSelectedAddOns(selectedAddOns.filter((x) => x.name !== a.name));
    } else if (maxAddOns === 1) {
      setSelectedAddOns([a]); // radio behavior
    } else if (selectedAddOns.length < maxAddOns) {
      setSelectedAddOns([...selectedAddOns, a]);
    }
  };

  const unitPrice = computeUnitPrice(
    item,
    hasCuts ? selectedCut : undefined,
    hasSizes ? selectedSize : undefined,
    selectedAddOns,
    showPiecesStepper ? pieces : undefined,
  );
  const lineTotal = unitPrice * qty;

  const fromPrice = hasCuts
    ? Math.min(...cuts.map((c) => Number(c.price) * Math.max(1, Number(c.min_pieces ?? 1))))
    : hasSizes
      ? Math.min(...sizes.map((s) => Number(s.price)))
      : Number(item.price);

  const handleAdd = () => {
    if (hasCuts && !selectedCut) {
      setShowCutError(true);
      // Scroll cut section into view-ish (best effort)
      return;
    }
    if (hasSizes && !selectedSize) {
      setShowSizeError(true);
      return;
    }
    onAdd(
      item,
      qty,
      hasCuts ? selectedCut : undefined,
      hasSizes ? selectedSize : undefined,
      selectedAddOns.length > 0 ? selectedAddOns : undefined,
      showPiecesStepper ? pieces : undefined,
    );
    onClose();
  };

  const ctaDisabled = (hasCuts && !selectedCut) || (hasSizes && !selectedSize);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={onClose} />

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
          {item.caption && <p className="mt-1 text-sm text-muted-foreground">{item.caption}</p>}
          <p className="mt-2 font-display text-lg font-bold text-primary">
            {hasCuts || hasSizes ? "From " : ""}
            {storeInfo.currency}
            {fromPrice.toFixed(0)}
          </p>

          {/* CUTS — required, mutually exclusive (radio) */}
          {hasCuts && (
            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                  <Drumstick className="h-3.5 w-3.5 text-primary" /> Choose your cut
                </h3>
                <span className="text-[10px] font-bold uppercase text-destructive">Required</span>
              </div>
              <div className="space-y-2">
                {cuts.map((c, i) => {
                  const checked = selectedCut?.name === c.name;
                  return (
                    <label
                      key={`${c.name}-${i}`}
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
                              {c.name}
                            </p>
                            {c.popular && (
                              <span className="flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                                <Star className="h-2.5 w-2.5 fill-primary" /> Popular
                              </span>
                            )}
                          </div>
                          {c.description && (
                            <p className="truncate text-xs text-muted-foreground">
                              {c.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="ml-2 flex-shrink-0 font-display text-sm font-bold text-primary">
                        {storeInfo.currency}
                        {Number(c.price).toFixed(0)}
                        {Number(c.max_pieces ?? 1) > 1 && (
                          <span className="ml-0.5 text-[10px] font-semibold text-muted-foreground">
                            /pc
                          </span>
                        )}
                      </span>
                      <input
                        type="radio"
                        name="cut"
                        className="sr-only"
                        checked={checked}
                        onChange={() => {
                          setSelectedCut(c);
                          setShowCutError(false);
                        }}
                      />
                    </label>
                  );
                })}
              </div>
              {showCutError && (
                <p className="mt-2 text-xs font-semibold text-destructive">
                  Please choose a cut to continue.
                </p>
              )}

              {/* PIECES stepper — only when the chosen cut allows >1 pieces */}
              {showPiecesStepper && (
                <div className="mt-3 flex items-center justify-between rounded-xl border-2 border-primary/30 bg-primary/5 p-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                      How many pieces?
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {storeInfo.currency}
                      {Number(selectedCut!.price).toFixed(0)} per piece · min {cutMin}, max {cutMax}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPieces((p) => Math.max(cutMin, p - 1))}
                      disabled={pieces <= cutMin}
                      aria-label="Fewer pieces"
                      className="rounded-full bg-card p-1.5 text-foreground shadow-sm ring-1 ring-border disabled:opacity-40"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center font-display text-base font-bold text-foreground">
                      {pieces}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPieces((p) => Math.min(cutMax, p + 1))}
                      disabled={pieces >= cutMax}
                      aria-label="More pieces"
                      className="rounded-full bg-primary p-1.5 text-primary-foreground shadow-sm disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SIZES */}
          {hasSizes && (
            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Choose a size
                </h3>
                <span className="text-[10px] font-bold uppercase text-destructive">Required</span>
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
                  const checked = selectedAddOns.some((x) => x.name === a.name);
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
                        <p className="truncate text-sm font-semibold text-foreground">{a.name}</p>
                      </div>
                      <span
                        className={`ml-2 flex-shrink-0 text-xs font-bold ${
                          isFree ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
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
            disabled={ctaDisabled}
            className="btn-glow flex w-full items-center justify-between gap-3 rounded-xl gradient-maroon px-5 py-3.5 font-display text-sm font-bold text-primary-foreground shadow-maroon transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
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
