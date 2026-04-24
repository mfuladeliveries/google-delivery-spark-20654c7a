import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Star, Bike, ChefHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: number;
  customerId: string;
  driverId?: string | null;
  restaurantId?: string | null;
  restaurant: string;
  onSubmitted: () => void;
}

const StarRow = ({
  value,
  onChange,
  label,
  icon: Icon,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  icon: any;
}) => (
  <div>
    <div className="mb-2 flex items-center gap-1.5">
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </div>
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="transition-transform hover:scale-110 active:scale-95"
          aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            className={`h-9 w-9 ${
              n <= value ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/40"
            }`}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  </div>
);

const RatingDialog = ({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  customerId,
  driverId,
  restaurantId,
  restaurant,
  onSubmitted,
}: RatingDialogProps) => {
  const [foodRating, setFoodRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (foodRating < 1) {
      toast.error("Please rate the food");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("order_ratings").insert({
      order_id: orderId,
      customer_id: customerId,
      driver_id: driverId || null,
      restaurant_id: restaurantId || null,
      food_rating: foodRating,
      driver_rating: driverRating > 0 ? driverRating : null,
      comment: comment.trim(),
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message || "Couldn't save rating");
      return;
    }
    toast.success("Thanks for your feedback! 🙏");
    onSubmitted();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rate your order #{orderNumber}</DialogTitle>
          <DialogDescription>
            How was your experience with {restaurant}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <StarRow value={foodRating} onChange={setFoodRating} label="Food quality" icon={ChefHat} />
          {driverId && (
            <StarRow value={driverRating} onChange={setDriverRating} label="Delivery driver" icon={Bike} />
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Add a comment (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={400}
              rows={3}
              placeholder="Tell us what you loved or what could be better…"
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{comment.length}/400</p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground hover:bg-secondary disabled:opacity-50"
            >
              Maybe later
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || foodRating < 1}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit rating"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RatingDialog;
