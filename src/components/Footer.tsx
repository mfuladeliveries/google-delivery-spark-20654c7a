import { MapPin, Mail, Phone, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { storeInfo } from "@/data/menu";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card mt-12">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img
                src={storeInfo.logo}
                alt={storeInfo.name}
                className="h-8 w-8 rounded-full object-cover ring-2 ring-primary/30"
              />
              <span className="font-display text-base font-bold text-foreground">
                {storeInfo.name}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Fast, reliable food delivery across Mfuleni and surrounding areas. Order from your favourite local restaurants.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-sm text-foreground mb-3">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { to: "/", label: "Home" },
                { to: "/search", label: "Search Restaurants" },
                { to: "/orders", label: "My Orders" },
                { to: "/profile", label: "My Profile" },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* For Partners */}
          <div>
            <h4 className="font-semibold text-sm text-foreground mb-3">For Partners</h4>
            <ul className="space-y-2">
              {[
                { to: "/restaurant/dashboard", label: "Restaurant Dashboard" },
                { to: "/driver/auth", label: "Become a Driver" },
                { to: "/install", label: "Install App" },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-sm text-foreground mb-3">Contact Us</h4>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>{storeInfo.areas}</span>
              </li>
              <li>
                <a
                  href={`mailto:${storeInfo.email}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  {storeInfo.email}
                </a>
              </li>
              <li>
                <a
                  href={`https://wa.me/${storeInfo.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Phone className="h-4 w-4 shrink-0 text-primary" />
                  WhatsApp
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {currentYear} {storeInfo.name}. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            {storeInfo.paymentNote}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
