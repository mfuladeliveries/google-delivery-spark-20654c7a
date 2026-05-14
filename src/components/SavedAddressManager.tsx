import { useState } from "react";
import { Edit2, Home, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { useCustomerAddresses, type SavedAddress } from "@/hooks/useCustomerAddresses";
import { useCustomerLocation } from "@/hooks/useCustomerLocation";
import { SavedAddressDialog } from "@/components/SavedAddressDialog";
import { toast } from "sonner";

export const SavedAddressManager = () => {
  const { addresses, loading, add, update, remove, setDefault } = useCustomerAddresses();
  const { zones, refresh: refreshLocation } = useCustomerLocation();
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [adding, setAdding] = useState(false);

  const handleSave = async (input: Parameters<typeof add>[0]) => {
    if (editing) {
      const ok = await update(editing.id, input);
      if (ok) toast.success("Address updated");
      else toast.error("Failed to update address");
    } else {
      const created = await add(input);
      if (created) toast.success("Address saved");
      else toast.error("Failed to save address");
    }
    refreshLocation();
  };

  const handleDelete = async (a: SavedAddress) => {
    if (!confirm(`Delete "${a.label}" address?`)) return;
    const ok = await remove(a.id);
    if (ok) toast.success("Address removed");
    else toast.error("Failed to remove");
    refreshLocation();
  };

  const handleSetDefault = async (a: SavedAddress) => {
    if (a.is_default) return;
    const ok = await setDefault(a.id);
    if (ok) toast.success(`"${a.label}" is now your default`);
    refreshLocation();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm text-foreground">My Delivery Addresses</h2>
        <button
          onClick={() => {
            setEditing(null);
            setAdding(true);
          }}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Loading addresses…</div>
      ) : addresses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
          <MapPin className="mx-auto h-6 w-6 text-muted-foreground opacity-60" />
          <p className="mt-2 text-sm font-semibold text-foreground">No saved addresses yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Save your home, work or other places for faster checkout.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {addresses.map((a) => (
            <li
              key={a.id}
              className={`rounded-xl border p-3 transition-colors ${
                a.is_default ? "border-primary/40 bg-primary/5" : "border-border bg-background"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Home className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground">{a.label}</p>
                    {a.is_default && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        <Star className="h-2.5 w-2.5" /> Default
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground break-words">{a.address}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-end gap-1.5">
                {!a.is_default && (
                  <button
                    onClick={() => handleSetDefault(a)}
                    className="rounded-md px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10"
                  >
                    Set default
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditing(a);
                    setAdding(false);
                  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Edit"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(a)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SavedAddressDialog
        open={adding || editing !== null}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSave={handleSave}
        zones={zones}
        initial={editing}
      />
    </div>
  );
};

export default SavedAddressManager;
