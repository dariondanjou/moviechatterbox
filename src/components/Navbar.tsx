import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Film, Mic, BookmarkPlus, User, LogOut, Menu, X, ChevronDown, Flame, Star
} from "lucide-react";

export default function Navbar() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: searchResults } = trpc.movie.search.useQuery(
    { q: searchQuery, limit: 6 },
    { enabled: searchQuery.length > 1 }
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinks = [
    { href: "/browse", label: "Movies", icon: <Film className="w-4 h-4" /> },
    { href: "/browse?sort=trending", label: "Trending", icon: <Flame className="w-4 h-4" /> },
    { href: "/browse?sort=top", label: "Top Rated", icon: <Star className="w-4 h-4" /> },
    { href: "/rooms", label: "Live Rooms", icon: <Mic className="w-4 h-4" /> },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-[oklch(0.12_0_0)/95] backdrop-blur-md border-b border-border">
      <div className="container">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Film className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl text-white tracking-wider hidden sm:block">
              MOVIE<span className="text-primary">CHATTERBOX</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location === link.href || location.startsWith(link.href.split("?")[0])
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>

          {/* Search */}
          <div ref={searchRef} className="flex-1 max-w-sm relative hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search movies, people..."
                className="pl-9 bg-secondary border-border text-sm h-9"
              />
            </div>
            {searchOpen && searchQuery.length > 1 && searchResults && (
              <div className="absolute top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-2xl overflow-hidden z-50">
                {searchResults.movies.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider border-b border-border">
                      Movies
                    </div>
                    {searchResults.movies.map(m => (
                      <Link
                        key={m.id}
                        href={`/movie/${m.slug}`}
                        onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-secondary transition-colors"
                      >
                        <img
                          src={m.posterUrl || "https://via.placeholder.com/32x48/1a1a1a/ff6b35?text=?"}
                          alt={m.title}
                          className="w-8 h-12 object-cover rounded"
                        />
                        <div>
                          <div className="text-sm font-medium text-foreground line-clamp-1">{m.title}</div>
                          <div className="text-xs text-muted-foreground">{m.year} · ⭐ {m.imdbRating}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {searchResults.persons.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider border-b border-border">
                      People
                    </div>
                    {searchResults.persons.map(p => (
                      <Link
                        key={p.id}
                        href={`/person/${p.slug}`}
                        onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-secondary transition-colors"
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={p.photoUrl || undefined} />
                          <AvatarFallback className="bg-secondary text-xs">{p.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium text-foreground">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.knownFor}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {searchResults.movies.length === 0 && searchResults.persons.length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">No results found</div>
                )}
              </div>
            )}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <>
                <Link href="/watchlist">
                  <Button variant="ghost" size="icon" className="hidden sm:flex text-muted-foreground hover:text-foreground">
                    <BookmarkPlus className="w-5 h-5" />
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <Avatar className="w-8 h-8 ring-2 ring-primary/50">
                        <AvatarImage src={(user as any).avatarUrl || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                          {user.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
                    <div className="px-3 py-2 border-b border-border">
                      <div className="text-sm font-medium text-foreground">{user.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    </div>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                        <User className="w-4 h-4" /> My Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/watchlist" className="flex items-center gap-2 cursor-pointer">
                        <BookmarkPlus className="w-4 h-4" /> Watchlist
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                      <LogOut className="w-4 h-4 mr-2" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => window.location.href = "/auth"}
              >
                Sign In
              </Button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border py-3 space-y-1">
            {/* Mobile Search */}
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search movies, people..."
                  className="pl-9 bg-secondary border-border text-sm h-9"
                />
              </div>
            </div>
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
