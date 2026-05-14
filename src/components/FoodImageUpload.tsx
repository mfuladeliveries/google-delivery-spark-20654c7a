import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Image } from "lucide-react";
import { toast } from "sonner";

interface FoodImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  restaurantId?: string;
}

const FoodImageUpload = ({ value, onChange, restaurantId }: FoodImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const folder = restaurantId || "general";
    const path = `${folder}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("food-images")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Upload failed: " + error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("food-images").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    setPreview(publicUrl);
    onChange(publicUrl);
    toast.success("Image uploaded!");
    setUploading(false);
  };

  const handleClear = () => {
    setPreview("");
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border bg-muted">
          <img src={preview} alt="Food preview" className="w-full h-32 object-cover" />
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 rounded-full bg-card/90 p-1 shadow-sm hover:bg-destructive/10 transition-colors"
          >
            <X className="h-4 w-4 text-foreground" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-6 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
          {uploading ? (
            <>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-xs text-muted-foreground font-medium">Uploading...</span>
            </>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Image className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Upload food image</span>
              <span className="text-[10px] text-muted-foreground">JPG, PNG up to 5MB</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
        </label>
      )}
    </div>
  );
};

export default FoodImageUpload;
