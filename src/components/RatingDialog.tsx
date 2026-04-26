import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  restaurantId: string | null;
  driverId: string | null;
  customerId: string;
  restaurantName: string;
  /** Called after a successful save so the parent can mark this order as rated. */
  onSaved?: () => void;
}

interface StarRowProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const StarRow = ({ label, value, onChange }: StarRowProps) => (
  <div>
    <p className="mb-1.5 text-sm font-semibold text-foreground">{label}</p>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onChange(n)}
            className="rounded-md p-1 transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              className={`h-7 w-7 ${
                filled ? "fill-primary text-primary" : "text-muted-foreground"
              }`}
            />
          </button>
        );
      })}
    </div>
  </div>
);

export const RatingDialog = ({
  open,
  onOpenChange,
  orderId,
  restaurantId,
  driverId,
  customerId,
  restaurantName,
  onSaved,
}: RatingDialogProps) => {
  const [foodRating, setFoodRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFoodRating(0);
    setDriverRating(0);
    setComment("");
  };

  const handleSubmit = async () => {
    if (foodRating < 1) {
      toast.error("Please rate the food");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("order_ratings").insert({
      order_id: orderId,
      customer_id: customerId,
      restaurant_id: restaurantId,
      driver_id: driverId,
      food_rating: foodRating,
      driver_rating: driverRating > 0 ? driverRating : null,
      comment: comment.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not save your rating");
      return;
    }
    toast.success("Thanks for your feedback!", {
      description: `Your rating for ${restaurantName} was saved.`,
      duration: 3000,
      closeButton: true,
    });
    reset();
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate your order</DialogTitle>
          <DialogDescription>
            How was your delivery from {restaurantName}? Your feedback helps everyone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <StarRow label="Food quality" value={foodRating} onChange={setFoodRating} />
          {driverId && (
            <StarRow label="Driver" value={driverRating} onChange={setDriverRating} />
          )}
          <div>
            <p className="mb-1.5 text-sm font-semibold text-foreground">
              Comment <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share what you loved or what we can improve…"
              rows={3}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={saving || foodRating < 1}>
            {saving ? "Saving…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RatingDialog;
