import { useState } from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
  value?: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
}

export default function StarRating({
  value = 0, onChange, readonly = false, size = "md", showValue = false,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const sizeClass = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-7 h-7" : "w-5 h-5";
  const displayValue = hovered ?? value;
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-1">
      {stars.map(star => {
        const filled = star <= Math.floor(displayValue);
        const half = !filled && star - 0.5 <= displayValue;
        return (
          <button
            key={star}
            disabled={readonly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(null)}
            className={`transition-transform ${!readonly ? "hover:scale-110 cursor-pointer" : "cursor-default"}`}
          >
            <Star
              className={`${sizeClass} transition-colors ${
                filled
                  ? "text-yellow-400 fill-yellow-400"
                  : half
                  ? "text-yellow-400 fill-yellow-200"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        );
      })}
      {showValue && value > 0 && (
        <span className="text-sm text-muted-foreground ml-1">{value.toFixed(1)}</span>
      )}
    </div>
  );
}
