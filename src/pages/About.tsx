import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { storeInfo } from "@/data/menu";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import {
  Target,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export interface AboutContent {
  title: string;
  description: string;
  mission: string;
  services: string[];
  service_area: string;
  phone: string;
  email: string;
}

export const DEFAULT_ABOUT: AboutContent = {
  title: "About Mfula Deliveries",
  description:
    "Mfula Deliveries is a fast, reliable food delivery service connecting local restaurants with customers in Mfuleni and surrounding areas. Our mission is to make ordering food simple, affordable, and convenient while supporting local businesses.",
  mission:
    "To deliver quality meals quickly while empowering local restaurants and creating opportunities for drivers.",
  services: [
    "Food delivery from multiple restaurants",
    "Real-time order tracking",
    "Fast and secure checkout",
    "Dedicated driver network",
  ],
  service_area: "Currently serving Mfuleni and nearby areas.",
  phone: "068 676 8409",
  email: "mfuladeliveries@gmail.com",
};

const About = () => {
  const [content, setContent] = useState<AboutContent>(DEFAULT_ABOUT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchContent = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "about_page")
        .maybeSingle();
      if (mounted && data?.value) {
        setContent({ ...DEFAULT_ABOUT, ...(data.value as Partial<AboutContent>) });
      }
      if (mounted) setLoading(false);
    };

    fetchContent();

    // Realtime updates
    const channel = supabase
      .channel("about_page_settings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: "key=eq.about_page",
        },
        (payload) => {
          const next = (payload.new as { value?: Partial<AboutContent> } | null)?.value;
          if (next) setContent({ ...DEFAULT_ABOUT, ...next });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const phoneTel = content.phone.replace(/\s+/g, "");

  return (
    <div className="min-h-screen bg-background">
      <Header title="About" />

      <main className="mx-auto max-w-3xl px-4 py-6 pb-nav md:pb-10">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* Banner */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-10 shadow-card">
          <div className="flex flex-col items-center text-center gap-4">
            <img
              src={storeInfo.logo}
              alt={storeInfo.name}
              className="h-20 w-20 rounded-full object-cover ring-4 ring-primary/30 shadow-orange"
            />
            {loading ? (
              <>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-full max-w-lg" />
                <Skeleton className="h-4 w-3/4 max-w-md" />
              </>
            ) : (
              <>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                  {content.title}
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
                  {content.description}
                </p>
              </>
            )}
          </div>
        </section>

        {/* Mission */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">Our Mission</h2>
          </div>
          {loading ? (
            <Skeleton className="h-4 w-full" />
          ) : (
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {content.mission}
            </p>
          )}
        </section>

        {/* Services */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">Our Services</h2>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-3/4" />
              ))}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {content.services.map((service, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm sm:text-base text-foreground">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                  <span>{service}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Service Area */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">Service Area</h2>
          </div>
          {loading ? (
            <Skeleton className="h-4 w-2/3" />
          ) : (
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {content.service_area}
            </p>
          )}
        </section>

        {/* Contact */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">Contact Information</h2>
          </div>

          <div className="space-y-3">
            <a
              href={`tel:${phoneTel}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              <Phone className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Phone</div>
                <div className="font-medium truncate">{content.phone}</div>
              </div>
            </a>

            <a
              href={`mailto:${content.email}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</div>
                <div className="font-medium truncate">{content.email}</div>
              </div>
            </a>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={`tel:${phoneTel}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-orange hover:scale-[1.02] active:scale-95 transition-transform"
            >
              <Phone className="h-4 w-4" />
              Call Us
            </a>
            <a
              href={`mailto:${content.email}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/20 active:scale-95 transition-all"
            >
              <Mail className="h-4 w-4" />
              Email Us
            </a>
          </div>
        </section>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
};

export default About;
