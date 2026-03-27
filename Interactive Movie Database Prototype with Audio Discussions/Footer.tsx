import { Link } from "wouter";
import { Film } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="container py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Film className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display text-xl text-white tracking-wider">
                CINE<span className="text-primary">VERSE</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your universe of cinema. Discover, rate, and discuss movies with fellow film lovers.
            </p>
          </div>

          {/* Discover */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Discover</h4>
            <ul className="space-y-2">
              {[
                { href: "/browse", label: "Browse Movies" },
                { href: "/browse?sort=trending", label: "Trending" },
                { href: "/browse?sort=top", label: "Top Rated" },
                { href: "/rooms", label: "Live Rooms" },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Account</h4>
            <ul className="space-y-2">
              {[
                { href: "/profile", label: "My Profile" },
                { href: "/watchlist", label: "Watchlist" },
                { href: "/profile", label: "My Reviews" },
                { href: "/profile", label: "My Ratings" },
              ].map(l => (
                <li key={l.label}>
                  <Link href={l.href} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* About */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">CineVerse</h4>
            <ul className="space-y-2">
              {["About", "Privacy Policy", "Terms of Service", "Contact"].map(l => (
                <li key={l}>
                  <button
                    onClick={() => {}}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    {l}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} CineVerse. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Movie data sourced from IMDb, Rotten Tomatoes, and Letterboxd
          </p>
        </div>
      </div>
    </footer>
  );
}
