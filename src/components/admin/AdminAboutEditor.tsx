import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, RotateCcw, Info } from "lucide-react";
import { DEFAULT_ABOUT, type AboutContent } from "@/pages/About";

const AdminAboutEditor = () => {
  const { user } = useAuth();
  const [content, setContent] = useState<AboutContent>(DEFAULT_ABOUT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "about_page")
        .maybeSingle();
      if (data?.value) {
        setContent({ ...DEFAULT_ABOUT, ...(data.value as Partial<AboutContent>) });
      }
      setLoading(false);
    };
    load();
  }, []);

  const updateField = <K extends keyof AboutContent>(key: K, value: AboutContent[K]) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  const updateService = (idx: number, value: string) => {
    setContent((prev) => ({
      ...prev,
      services: prev.services.map((s, i) => (i === idx ? value : s)),
    }));
  };

  const addService = () => {
    setContent((prev) => ({ ...prev, services: [...prev.services, ""] }));
  };

  const removeService = (idx: number) => {
    setContent((prev) => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async () => {
    if (!content.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const cleaned: AboutContent = {
      ...content,
      services: content.services.map((s) => s.trim()).filter(Boolean),
    };
    const { error } = await (supabase.from("app_settings") as any).upsert(
      {
        key: "about_page",
        value: cleaned,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      },
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) {
      toast.error("Failed to save", { description: error.message });
      return;
    }
    setContent(cleaned);
    toast.success("About page updated");
  };

  const handleReset = () => {
    setContent(DEFAULT_ABOUT);
    toast.info("Reverted to defaults — click Save to publish");
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p>
          Edit the public About page. Changes save to the database and update live for visitors — no
          redeploy needed.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
        <div>
          <Label className="text-xs font-semibold">Page Title</Label>
          <Input
            value={content.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="About Mfula Deliveries"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs font-semibold">Short Description</Label>
          <Textarea
            value={content.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={4}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs font-semibold">Our Mission</Label>
          <Textarea
            value={content.mission}
            onChange={(e) => updateField("mission", e.target.value)}
            rows={3}
            className="mt-1"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-xs font-semibold">Our Services</Label>
          <Button type="button" size="sm" variant="outline" onClick={addService} className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {content.services.map((service, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={service}
                onChange={(e) => updateService(idx, e.target.value)}
                placeholder={`Service ${idx + 1}`}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeService(idx)}
                className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {content.services.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-2">No services yet — add one.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
        <div>
          <Label className="text-xs font-semibold">Service Area</Label>
          <Textarea
            value={content.service_area}
            onChange={(e) => updateField("service_area", e.target.value)}
            rows={2}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold">Phone</Label>
            <Input
              value={content.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="068 676 8409"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Email</Label>
            <Input
              type="email"
              value={content.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="mfuladeliveries@gmail.com"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <div className="sticky bottom-20 md:bottom-4 flex gap-2 rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-3 shadow-card">
        <Button variant="outline" onClick={handleReset} disabled={saving} className="flex-1">
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Reset
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default AdminAboutEditor;
