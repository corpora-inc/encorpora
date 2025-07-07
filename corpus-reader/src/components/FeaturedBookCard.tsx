import { useLoadImage } from "@/lib/hooks/useLoadImage";
import { Button } from "./ui/button";
import { BookEntry } from "@/lib/utils";
import {
  BookIcon,
  PlayIcon,
  BookOpenIcon,
  ClockIcon,
  StarIcon,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { useNavigate } from "react-router-dom";

const FeaturedBookCard = ({ book }: { book: BookEntry }) => {
  const { imageUrl } = useLoadImage(book.cover_path);
  const navigate = useNavigate();

  const handleContinueReading = () => {
    navigate(`/reader/${encodeURIComponent(book.path)}`);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-500 bg-gradient-to-r from-card/80 to-card/60 backdrop-blur-sm border border-border/50 group">
      <div className="flex flex-col md:flex-row  md:h-[270px]">
        {/* Image Section */}
        <div className="relative w-full md:w-2/5 h-[200px] sm:h-[240px] md:h-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/80 via-black/40 to-transparent z-10" />
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${book.title || "Book"} cover`}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/70">
              <BookIcon className="w-16 h-16 sm:w-20 sm:h-20 text-muted-foreground opacity-50" />
            </div>
          )}

          {/* Play button overlay - hidden on mobile, shown on hover for desktop */}
          <div className="absolute inset-0 items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 hidden md:flex">
            <button
              type="button"
              onClick={handleContinueReading}
              aria-label="Play Book"
              className="cursor-pointer bg-primary/90 backdrop-blur-sm rounded-full p-4 shadow-2xl transform scale-75 group-hover:scale-100 transition-transform duration-300 focus:outline-none"
            >
              <PlayIcon className="w-8 h-8 text-primary-foreground fill-current" />
            </button>
          </div>

          {/* Status badges */}
          <div className="absolute top-3 left-3 md:top-4 md:left-4 z-20 flex flex-col gap-2">
            {book.lang && (
              <Badge
                className="border-0 shadow-lg text-xs uppercase rounded-sm"
                variant="secondary"
              >
                {book.lang}
              </Badge>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="relative flex-1 p-4 sm:p-6 md:p-6 lg:p-8 flex flex-col justify-between">
          <div className="space-y-3 sm:space-y-4">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-2xl lg:text-3xl font-bold mb-2 sm:mb-3 line-clamp-2 text-foreground leading-tight">
                {book.title || "Untitled Book"}
              </h2>
              <p className="text-base sm: -lg text-muted-foreground font-medium">
                {book.author || "Unknown Author"}
              </p>
              {book.publisher && (
                <p className="text-xs sm:text-sm text-muted-foreground/80 mt-1">
                  Published by {book.publisher}
                </p>
              )}
            </div>

            {/* Book metadata */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              {book.last_read && (
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" />
                  <span>
                    Last read {new Date(book.last_read).toLocaleDateString()}
                  </span>
                </div>
              )}
              {book.rating > 0 && (
                <div className="flex items-center gap-1">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <StarIcon
                        key={star}
                        className={`w-3 h-3 ${
                          star <= book.rating
                            ? "text-amber-400 fill-current"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="ml-1">({book.rating}/5)</span>
                </div>
              )}
            </div>

            {/* Progress section */}
            {book.progress > 0 && (
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground font-medium">
                    Reading Progress
                  </span>
                  <span className="font-bold text-foreground text-sm sm:text-lg">
                    {Math.round(book.progress)}%
                  </span>
                </div>
                <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 rounded-full"
                    style={{ width: `${book.progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {book.is_finished
                    ? "🎉 Congratulations! You've finished this book."
                    : `Keep going! You're ${Math.round(
                        book.progress
                      )}% through.`}
                </p>
              </div>
            )}
          </div>

          {/* Action button */}
          <div className="mt-4 sm:mt-6 md:mt-8">
            <Button
              onClick={handleContinueReading}
              className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 h-11 sm:h-12 text-sm sm:text-base font-medium"
              size="lg"
            >
              <BookOpenIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              {book.is_finished
                ? "Read Again"
                : book.progress > 0
                ? "Continue Reading"
                : "Start Reading"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturedBookCard;
