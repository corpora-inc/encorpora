import { useLoadImage } from "@/lib/hooks/useLoadImage";
import { BookIcon, BookOpenIcon } from "lucide-react";
import DeleteBookButton from "./DeleteBookButton";
import { BookCardListProps } from "./BookGrid";

const BookCard: React.FC<BookCardListProps> = ({ book, handleBookClick, onBookDeleted }) => {
    const { imageUrl } = useLoadImage(book.cover_path);

    return (
        <div
            className="group cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            onClick={async () => await handleBookClick(book.path)}
        >
            <div className="relative aspect-[2/3] mb-3 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-muted/50 to-muted/80">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={`${book.title || "Book"} cover`}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/80 to-muted/60">
                        <BookIcon className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-muted-foreground opacity-70" />
                    </div>
                )}

                {/* Gradient overlay for better text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Reading progress indicator */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20 backdrop-blur-sm">
                    <div
                        className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300"
                        style={{ width: `${book.progress || 0}%` }}
                    />
                </div>

                {/* Status badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {book.lang && (
                        <div className="px-2 py-0.5 bg-background/80 backdrop-blur-sm rounded text-xs font-medium uppercase tracking-wide">
                            {book.lang}
                        </div>
                    )}
                </div>

                {/* Delete button */}
                <div className="absolute top-2 right-2 z-50 ">
                    <DeleteBookButton bookId={book.id} bookTitle={book.title} onBookDeleted={onBookDeleted} />
                </div>

                {/* Quick action overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="bg-background/90 backdrop-blur-sm rounded-full p-3 shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                        <BookOpenIcon className="w-6 h-6 text-primary" />
                    </div>
                </div>
            </div>

            <div className="space-y-1">
                <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors duration-200 leading-tight">
                    {book.title || "Untitled Book"}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-1">
                    {book.author || "Unknown Author"}
                </p>

                {/* Rating and progress row */}
                <div className="flex items-center justify-between pt-1">
                    {book.rating > 0 ? (
                        <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                    key={star}
                                    className={`w-3 h-3 ${star <= book.rating
                                        ? "text-amber-400"
                                        : "text-muted-foreground/30"
                                        }`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            ))}
                        </div>
                    ) : (
                        <div />
                    )}

                    <div className="text-xs text-muted-foreground font-medium">
                        {book.progress > 0 ? `${Math.round(book.progress)}%` : "New"}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BookCard;