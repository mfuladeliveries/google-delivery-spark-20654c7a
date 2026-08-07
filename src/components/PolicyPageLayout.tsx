import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarClock, Mail, Phone, MapPin } from "lucide-react";
import Footer from "@/components/Footer";
import { POLICY_CONTACT, formatPolicyDate } from "@/lib/policies";

interface PolicyPageLayoutProps {
  title: string;
  intro: string;
  version: string;
  children: ReactNode;
}

/** Shared reading layout for the public legal policy pages. */
const PolicyPageLayout = ({ title, intro, version, children }: PolicyPageLayoutProps) => (
  <div className="min-h-screen bg-background">
    <div className="gradient-maroon text-primary-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-primary-foreground/80 transition-colors hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-primary-foreground/80">{intro}</p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-medium text-gold">
          <CalendarClock className="h-3.5 w-3.5" />
          Last updated: {formatPolicyDate(version)}
        </p>
      </div>
    </div>

    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <article className="space-y-8 text-[15px] leading-relaxed text-foreground/90">{children}</article>

      <section className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-luxury">
        <h2 className="font-display text-lg font-bold text-primary">Contact Details</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="font-semibold text-foreground">{POLICY_CONTACT.business}</li>
          <li className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-gold" /> {POLICY_CONTACT.email}
          </li>
          <li className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-gold" /> {POLICY_CONTACT.phone}
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gold" /> Operating area: {POLICY_CONTACT.area}
          </li>
        </ul>
      </section>

      <Link
        to="/"
        className="btn-glow mt-8 inline-flex items-center gap-2 rounded-xl gradient-maroon px-5 py-3 font-display text-sm font-bold text-primary-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to home page
      </Link>
    </main>

    <Footer />
  </div>
);

/** A numbered policy section with a heading and free-form body. */
export const PolicySection = ({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) => (
  <section className="space-y-3">
    <h2 className="font-display text-lg font-bold text-primary sm:text-xl">{heading}</h2>
    <div className="space-y-3">{children}</div>
  </section>
);

/** Bulleted list used throughout the policies. */
export const PolicyList = ({ items }: { items: string[] }) => (
  <ul className="ml-1 space-y-2">
    {items.map((item) => (
      <li key={item} className="flex gap-2">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

export default PolicyPageLayout;
