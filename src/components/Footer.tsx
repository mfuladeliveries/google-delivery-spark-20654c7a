import { MapPin, Mail, Phone, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { storeInfo } from "@/data/menu";
import { POLICY_LINKS } from "@/lib/policies";

const Footer = () => {
  return (
    <footer className="border-t border-border/50 gradient-dark text-primary-foreground mt-12">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img
                src={storeInfo.logo}
                alt={storeInfo.name}
                className="h-8 w-8 rounded-full object-cover ring-2 ring-gold/40"
              />
              <span className="font-display text-base font-bold text-gold">{storeInfo.name}</span>
            </div>
            <p className="text-sm text-primary-foreground/70 leading-relaxed">
              Fast, reliable food delivery across Mfuleni and surrounding areas. Order from your
              favourite local restaurants.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-sm text-gold mb-3">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { to: "/", label: "Home" },
                { to: "/search", label: "Search Restaurants" },
                { to: "/orders", label: "My Orders" },
                { to: "/profile", label: "My Profile" },
                { to: "/about", label: "About Us" },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-primary-foreground/70 hover:text-gold transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* For Partners */}
          <div>
            <h4 className="font-semibold text-sm text-gold mb-3">For Partners</h4>
            <ul className="space-y-2">
              {[
                { to: "/restaurant/dashboard", label: "Restaurant Dashboard" },
                { to: "/driver/auth", label: "Become a Driver" },
                { to: "/install", label: "Install App" },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-primary-foreground/70 hover:text-gold transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-sm text-gold mb-3">Contact Us</h4>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2 text-sm text-primary-foreground/70">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gold" />
                <span>{storeInfo.areas}</span>
              </li>
              <li>
                <a
                  href={`mailto:${storeInfo.email}`}
                  className="flex items-center gap-2 text-sm text-primary-foreground/70 hover:text-gold transition-colors"
                >
                  <Mail className="h-4 w-4 shrink-0 text-gold" />
                  {storeInfo.email}
                </a>
              </li>
              <li>
                <a
                  href={`https://wa.me/${storeInfo.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary-foreground/70 hover:text-gold transition-colors"
                >
                  <Phone className="h-4 w-4 shrink-0 text-gold" />
                  WhatsApp
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal */}
        <div className="mt-8 pt-6 border-t border-primary-foreground/20">
          <h4 className="font-semibold text-sm text-gold mb-3">Legal</h4>
          <ul className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-6">
            {POLICY_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="text-sm text-primary-foreground/70 hover:text-gold transition-colors underline-offset-4 hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-primary-foreground/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-primary-foreground/50">
            © 2019 {storeInfo.name}. All rights reserved.
          </p>
          <p className="text-xs text-primary-foreground/50">{storeInfo.paymentNote}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
