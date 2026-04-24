import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Star,
  Search,
  ChefHat,
  Phone,
  Clock,
  MapPin,
  Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isRestaurantOpen } from "@/lib/restaurantHours";
import FoodImageUpload from "@/components/FoodImageUpload";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const CATEGORIES = [
  "Braai",
  "Sides",
  "Drinks",
  "Starters",
  "Mains",
  "Desserts",
  "Specials",
];

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  description: string;
  location: string;
  rating: number;
  min_order: number;
  delivery_time: string;
  is_active: boolean;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
  contact_number: string | null;
  operating_days: string[] | null;
  image_url: string | null;
  banner_url: string | null;
  logo: string | null;
}

interface SizeOption {
  name: string;
  price: number;
  popular?: boolean;
}

interface AddOnOption {
  name: string;
  price: number;
}

interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  image_url: string | null;
  is_available: boolean;
  is_popular: boolean;
  has_sizes: boolean;
  sizes: SizeOption[];
  has_add_ons: boolean;
  add_ons: AddOnOption[];
}

type FilterMode = "all" | "open" | "closed";

const AdminMenuManager = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuCounts, setMenuCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selected, setSelected] = useState<Restaurant | null>(null);

  const fetchRestaurants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("restaurants")
      .select(
        "id, name, cuisine, description, location, rating, min_order, delivery_time, is_active, is_open, opens_at, closes_at, contact_number, operating_days, image_url, banner_url, logo",
      )
      .order("name");
    if (error) {
      toast.error("Failed to load restaurants");
      setLoading(false);
      return;
    }
    const list = (data ?? []) as unknown as Restaurant[];
    setRestaurants(list);

    // Counts of menu items per restaurant
    const { data: counts } = await supabase.from("menu_items").select("restaurant_id");
    const map: Record<string, number> = {};
    (counts ?? []).forEach((r: any) => {
      map[r.restaurant_id] = (map[r.restaurant_id] ?? 0) + 1;
    });
    setMenuCounts(map);
    setLoading(false);
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const isOpenNow = (r: Restaurant) =>
    r.is_active && r.is_open && isRestaurantOpen(r.opens_at, r.closes_at);

  const filtered = useMemo(() => {
    return restaurants
      .filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
      .filter(r => {
        if (filter === "all") return true;
        const open = isOpenNow(r);
        return filter === "open" ? open : !open;
      });
  }, [restaurants, search, filter]);

  if (selected) {
    return (
      <RestaurantDetail
        restaurant={selected}
        onBack={() => {
          setSelected(null);
          fetchRestaurants();
        }}
        onUpdated={updated => setSelected(updated)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ChefHat className="h-5 w-5 text-primary" />
        <h2 className="font-bold text-foreground">Restaurant & Menu Management</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search restaurants..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2">
        {(["all", "open", "closed"] as FilterMode[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold capitalize transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {f === "all" ? "Show All" : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No restaurants found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const open = isOpenNow(r);
            return (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${open ? "bg-green-500" : "bg-red-500"}`}
                    aria-label={open ? "Open" : "Closed"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate font-bold text-primary">{r.name}</h3>
                      <span className="text-xs font-semibold text-primary">Manage →</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.cuisine || "—"} · {menuCounts[r.id] ?? 0} menu items
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      ⭐ {Number(r.rating ?? 0).toFixed(1)} · Min R{Number(r.min_order ?? 0).toFixed(0)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Restaurant detail + menu list
// ─────────────────────────────────────────────────────────────────────
const RestaurantDetail = ({
  restaurant,
  onBack,
  onUpdated,
}: {
  restaurant: Restaurant;
  onBack: () => void;
  onUpdated: (r: Restaurant) => void;
}) => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [deleteRestaurantOpen, setDeleteRestaurantOpen] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("category")
      .order("name");
    if (error) {
      toast.error("Failed to load menu");
    } else {
      setItems((data ?? []) as unknown as MenuItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => i.category && set.add(i.category));
    return ["All", ...Array.from(set)];
  }, [items]);

  const filteredItems = items.filter(i =>
    categoryFilter === "All" ? true : i.category === categoryFilter,
  );

  const toggleAvailability = async (item: MenuItem) => {
    const next = !item.is_available;
    const { error } = await supabase
      .from("menu_items")
      .update({ is_available: next })
      .eq("id", item.id);
    if (error) {
      toast.error("Update failed");
      return;
    }
    setItems(items.map(i => (i.id === item.id ? { ...i, is_available: next } : i)));
    toast.success(`${item.name} ${next ? "🟢 is now Available" : "🔴 marked as Sold Out"}`);
  };

  const togglePopular = async (item: MenuItem) => {
    const next = !item.is_popular;
    const { error } = await supabase
      .from("menu_items")
      .update({ is_popular: next })
      .eq("id", item.id);
    if (error) {
      toast.error("Update failed");
      return;
    }
    setItems(items.map(i => (i.id === item.id ? { ...i, is_popular: next } : i)));
    toast.success(next ? `⭐ ${item.name} marked Popular` : `${item.name} popular badge removed`);
  };

  const deleteItem = async (item: MenuItem) => {
    const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
    if (error) {
      toast.error("Delete failed");
      return;
    }
    setItems(items.filter(i => i.id !== item.id));
    toast.success(`🗑️ ${item.name} deleted`);
  };

  const toggleRestaurantOpen = async () => {
    const next = !restaurant.is_open;
    const { error } = await supabase
      .from("restaurants")
      .update({ is_open: next })
      .eq("id", restaurant.id);
    if (error) {
      toast.error("Update failed");
      return;
    }
    onUpdated({ ...restaurant, is_open: next });
    toast.success(next ? `🟢 ${restaurant.name} is now Open` : `🔴 ${restaurant.name} is now Closed`);
  };

  const heroImage = restaurant.image_url || restaurant.banner_url || restaurant.logo;

  return (
    <div className="space-y-4 pb-8">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-semibold text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Restaurants
      </button>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {heroImage ? (
          <img src={heroImage} alt={restaurant.name} className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-muted">
            <ChefHat className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        <div className="p-4">
          <h2 className="text-xl font-bold text-foreground">{restaurant.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {restaurant.cuisine || "—"} · ⭐ {Number(restaurant.rating ?? 0).toFixed(1)}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEditInfo(true)} className="flex-col h-auto py-2">
              <Pencil className="h-4 w-4" />
              <span className="mt-1 text-[10px]">Edit Info</span>
            </Button>
            <Button
              variant={restaurant.is_open ? "default" : "secondary"}
              size="sm"
              onClick={toggleRestaurantOpen}
              className="flex-col h-auto py-2"
            >
              <Power className="h-4 w-4" />
              <span className="mt-1 text-[10px]">{restaurant.is_open ? "Open" : "Closed"}</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteRestaurantOpen(true)}
              className="flex-col h-auto py-2"
            >
              <Trash2 className="h-4 w-4" />
              <span className="mt-1 text-[10px]">Delete</span>
            </Button>
          </div>

          <div className="mt-4 space-y-1.5 text-xs text-foreground">
            <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {restaurant.location || "—"}</p>
            <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-muted-foreground" /> {restaurant.delivery_time || "—"}</p>
            <p>💰 Min order: R{Number(restaurant.min_order ?? 0).toFixed(0)}</p>
            {restaurant.contact_number && (
              <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {restaurant.contact_number}</p>
            )}
            <p>🏷️ Category: {restaurant.cuisine || "—"}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">🍽️ Menu Items ({items.length})</h3>
        <Button size="sm" onClick={() => setShowAddItem(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      </div>

      {categories.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                categoryFilter === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No menu items yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => (
            <MenuItemAdminCard
              key={item.id}
              item={item}
              onToggleAvailability={() => toggleAvailability(item)}
              onTogglePopular={() => togglePopular(item)}
              onEditFull={() => setEditingItem(item)}
              onDelete={() => deleteItem(item)}
              onItemUpdated={updated =>
                setItems(items.map(i => (i.id === updated.id ? updated : i)))
              }
            />
          ))}
        </div>
      )}

      {/* Add item dialog */}
      {showAddItem && (
        <MenuItemDialog
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          onClose={() => setShowAddItem(false)}
          onSaved={() => {
            setShowAddItem(false);
            fetchItems();
          }}
        />
      )}

      {/* Edit item dialog */}
      {editingItem && (
        <MenuItemDialog
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          existing={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            fetchItems();
          }}
        />
      )}

      {/* Edit restaurant info */}
      {showEditInfo && (
        <RestaurantInfoDialog
          restaurant={restaurant}
          onClose={() => setShowEditInfo(false)}
          onSaved={updated => {
            setShowEditInfo(false);
            onUpdated(updated);
          }}
        />
      )}

      {/* Delete restaurant */}
      <DeleteRestaurantDialog
        open={deleteRestaurantOpen}
        onOpenChange={setDeleteRestaurantOpen}
        restaurant={restaurant}
        itemCount={items.length}
        onDeleted={onBack}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Delete item with confirm
// ─────────────────────────────────────────────────────────────────────
const DeleteItemButton = ({ item, onDeleted }: { item: MenuItem; onDeleted: () => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="h-8 px-2 text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🗑️ Delete Menu Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "<strong>{item.name}</strong>"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOpen(false);
                onDeleted();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Delete restaurant (requires typing name)
// ─────────────────────────────────────────────────────────────────────
const DeleteRestaurantDialog = ({
  open,
  onOpenChange,
  restaurant,
  itemCount,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  restaurant: Restaurant;
  itemCount: number;
  onDeleted: () => void;
}) => {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const canDelete = confirm.trim() === restaurant.name;

  const handleDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    // Delete child menu items first (no FK ON DELETE CASCADE in current schema)
    await supabase.from("menu_items").delete().eq("restaurant_id", restaurant.id);
    const { error } = await supabase.from("restaurants").delete().eq("id", restaurant.id);
    setBusy(false);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    toast.success(`🗑️ ${restaurant.name} deleted`);
    onOpenChange(false);
    onDeleted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>⚠️ Delete Restaurant?</DialogTitle>
          <DialogDescription>
            Deleting "<strong>{restaurant.name}</strong>" will also delete ALL its menu items
            ({itemCount} items). This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Type the restaurant name to confirm:</Label>
          <Input
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder={restaurant.name}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!canDelete || busy}
            onClick={handleDelete}
          >
            Delete All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Menu item add/edit dialog (with sizes & add-ons)
// ─────────────────────────────────────────────────────────────────────
const MenuItemDialog = ({
  restaurantId,
  restaurantName,
  existing,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  restaurantName: string;
  existing?: MenuItem;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [price, setPrice] = useState(existing?.price?.toString() ?? "");
  const [category, setCategory] = useState(existing?.category || CATEGORIES[0]);
  const [imageUrl, setImageUrl] = useState(existing?.image_url || existing?.image || "");
  const [isAvailable, setIsAvailable] = useState(existing?.is_available ?? true);
  const [isPopular, setIsPopular] = useState(existing?.is_popular ?? false);
  const [hasSizes, setHasSizes] = useState(existing?.has_sizes ?? false);
  const [sizes, setSizes] = useState<SizeOption[]>(
    existing?.sizes?.length ? existing.sizes : [{ name: "Small", price: 0 }],
  );
  const [hasAddOns, setHasAddOns] = useState(existing?.has_add_ons ?? false);
  const [addOns, setAddOns] = useState<AddOnOption[]>(
    existing?.add_ons?.length ? existing.add_ons : [{ name: "", price: 0 }],
  );
  const [busy, setBusy] = useState(false);

  const updateSize = (i: number, patch: Partial<SizeOption>) =>
    setSizes(sizes.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const updateAddOn = (i: number, patch: Partial<AddOnOption>) =>
    setAddOns(addOns.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Item name is required");
    const priceNum = parseFloat(price);
    if (Number.isNaN(priceNum) || priceNum < 0) return toast.error("Valid price required");
    if (!category) return toast.error("Category is required");

    const payload = {
      restaurant_id: restaurantId,
      name: name.trim(),
      description: description.trim(),
      price: priceNum,
      category,
      image: imageUrl,
      image_url: imageUrl || null,
      is_available: isAvailable,
      is_popular: isPopular,
      has_sizes: hasSizes,
      sizes: (hasSizes ? sizes.filter(s => s.name.trim()) : []) as any,
      has_add_ons: hasAddOns,
      add_ons: (hasAddOns ? addOns.filter(a => a.name.trim()) : []) as any,
    };

    setBusy(true);
    const { error } = existing
      ? await supabase.from("menu_items").update(payload).eq("id", existing.id)
      : await supabase.from("menu_items").insert(payload as any);
    setBusy(false);

    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    toast.success(
      existing
        ? `✅ ${name} updated successfully`
        : `✅ ${name} added to ${restaurantName} menu`,
    );
    onSaved();
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "✏️ Edit Menu Item" : "➕ Add Menu Item"}</DialogTitle>
          <DialogDescription>{restaurantName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Item Photo</Label>
            <div className="mt-1">
              <FoodImageUpload value={imageUrl} onChange={setImageUrl} restaurantId={restaurantId} />
            </div>
            <Input
              placeholder="Or enter image URL"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <Label className="text-xs">Item Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chicken Piece" />
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Grilled chicken with your choice of sauce"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Price (ZAR) *</Label>
              <Input
                type="number"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label className="text-xs">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sizes */}
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-bold">Has Sizes? (e.g. S/M/L)</Label>
                <p className="text-[10px] text-muted-foreground">Customers pick a size at checkout</p>
              </div>
              <Switch checked={hasSizes} onCheckedChange={setHasSizes} />
            </div>
            {hasSizes && (
              <div className="mt-3 space-y-2">
                {sizes.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Size name"
                      value={s.name}
                      onChange={e => updateSize(i, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      value={s.price}
                      onChange={e => updateSize(i, { price: parseFloat(e.target.value) || 0 })}
                      className="w-24"
                    />
                    <Button
                      type="button"
                      variant={s.popular ? "default" : "outline"}
                      size="icon"
                      onClick={() => updateSize(i, { popular: !s.popular })}
                    >
                      <Star className={`h-4 w-4 ${s.popular ? "fill-current" : ""}`} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSizes(sizes.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSizes([...sizes, { name: "", price: 0 }])}
                  className="w-full"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Size
                </Button>
              </div>
            )}
          </div>

          {/* Add-ons */}
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-bold">Has Add-Ons? (e.g. sauces)</Label>
                <p className="text-[10px] text-muted-foreground">Set price 0 for FREE add-ons</p>
              </div>
              <Switch checked={hasAddOns} onCheckedChange={setHasAddOns} />
            </div>
            {hasAddOns && (
              <div className="mt-3 space-y-2">
                {addOns.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Add-on name"
                      value={a.name}
                      onChange={e => updateAddOn(i, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0 = FREE"
                      value={a.price}
                      onChange={e => updateAddOn(i, { price: parseFloat(e.target.value) || 0 })}
                      className="w-24"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setAddOns(addOns.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddOns([...addOns, { name: "", price: 0 }])}
                  className="w-full"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Sauce/Add-on
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <Label className="text-xs font-bold">Available</Label>
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <Label className="text-xs font-bold">Mark as Popular?</Label>
              <p className="text-[10px] text-muted-foreground">Shows ⭐ Popular badge</p>
            </div>
            <Switch checked={isPopular} onCheckedChange={setIsPopular} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy} className="bg-primary hover:bg-primary/90">
            {existing ? "Save Changes" : "Save Menu Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Edit restaurant info dialog
// ─────────────────────────────────────────────────────────────────────
const RestaurantInfoDialog = ({
  restaurant,
  onClose,
  onSaved,
}: {
  restaurant: Restaurant;
  onClose: () => void;
  onSaved: (r: Restaurant) => void;
}) => {
  const [name, setName] = useState(restaurant.name);
  const [description, setDescription] = useState(restaurant.description ?? "");
  const [cuisine, setCuisine] = useState(restaurant.cuisine ?? "");
  const [minOrder, setMinOrder] = useState(String(restaurant.min_order ?? 0));
  const [deliveryTime, setDeliveryTime] = useState(restaurant.delivery_time || "20-30 min");
  const [contactNumber, setContactNumber] = useState(restaurant.contact_number ?? "");
  const [location, setLocation] = useState(restaurant.location ?? "");
  const [opensAt, setOpensAt] = useState((restaurant.opens_at ?? "08:00").slice(0, 5));
  const [closesAt, setClosesAt] = useState((restaurant.closes_at ?? "22:00").slice(0, 5));
  const [days, setDays] = useState<string[]>(
    Array.isArray(restaurant.operating_days) ? restaurant.operating_days : [...DAYS],
  );
  const [isOpen, setIsOpen] = useState(restaurant.is_open);
  const [busy, setBusy] = useState(false);

  const toggleDay = (d: string) =>
    setDays(days.includes(d) ? days.filter(x => x !== d) : [...days, d]);

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Name required");
    setBusy(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      cuisine: cuisine.trim(),
      min_order: parseFloat(minOrder) || 0,
      delivery_time: deliveryTime,
      contact_number: contactNumber.trim(),
      location: location.trim(),
      opens_at: opensAt,
      closes_at: closesAt,
      operating_days: days,
      is_open: isOpen,
    };
    const { data, error } = await supabase
      .from("restaurants")
      .update(payload)
      .eq("id", restaurant.id)
      .select()
      .single();
    setBusy(false);
    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    toast.success("✅ Restaurant info updated");
    onSaved({ ...restaurant, ...(data as any) });
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>✏️ Edit Restaurant Info</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Restaurant Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Input value={cuisine} onChange={e => setCuisine(e.target.value)} placeholder="e.g. Braai" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Min Order (ZAR)</Label>
              <Input type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Delivery Time</Label>
              <Select value={deliveryTime} onValueChange={setDeliveryTime}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["15-20 min", "20-30 min", "30-45 min", "45-60 min"].map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Contact Number</Label>
            <Input value={contactNumber} onChange={e => setContactNumber(e.target.value)} placeholder="e.g. 068 281 9391" />
          </div>
          <div>
            <Label className="text-xs">Location / Area</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Mfuleni, Cape Town" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Opens at</Label>
              <Input type="time" value={opensAt} onChange={e => setOpensAt(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Closes at</Label>
              <Input type="time" value={closesAt} onChange={e => setClosesAt(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Operating Days</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {DAYS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    days.includes(d)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <Label className="text-xs font-bold">{isOpen ? "🟢 Open" : "🔴 Closed"}</Label>
            <Switch checked={isOpen} onCheckedChange={setIsOpen} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy} className="bg-primary hover:bg-primary/90">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminMenuManager;
