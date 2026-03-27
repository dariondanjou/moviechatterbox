import { Link } from "wouter";
import { Mic, Users, Radio } from "lucide-react";

interface AudioRoomCardProps {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  listenerCount?: number | null;
  speakerCount?: number | null;
  tags?: string | null;
  hostName?: string | null;
  hostAvatar?: string | null;
  isLive?: boolean | null;
}

export default function AudioRoomCard({
  name, slug, description, listenerCount, speakerCount, tags, hostName, hostAvatar, isLive,
}: AudioRoomCardProps) {
  const parsedTags: string[] = (() => {
    try { return JSON.parse(tags || "[]"); } catch { return []; }
  })();

  return (
    <Link href={`/rooms/${slug}`}>
      <div className="group bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-all hover:bg-card/80 cursor-pointer room-live-glow">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isLive && (
                  <span className="flex items-center gap-1 text-xs font-bold text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                {name}
              </h3>
            </div>
          </div>
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{description}</p>
        )}

        {/* Tags */}
        {parsedTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {parsedTags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Mic className="w-3 h-3" />
              {speakerCount || 0} speaking
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {listenerCount || 0} listening
            </span>
          </div>
          {hostName && (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-secondary overflow-hidden">
                {hostAvatar
                  ? <img src={hostAvatar} alt={hostName} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">{hostName.charAt(0)}</div>
                }
              </div>
              <span className="text-xs text-muted-foreground">{hostName}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
