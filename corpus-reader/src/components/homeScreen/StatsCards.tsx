import { BookOpenIcon, TrendingUpIcon, StarIcon } from "lucide-react";

interface StatsCardsProps {
  totalBooks: number;
  booksInProgress: number;
  booksCompleted: number;
}

export function StatsCards({
  totalBooks,
  booksInProgress,
  booksCompleted,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-md transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BookOpenIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{totalBooks}</p>
            <p className="text-sm text-muted-foreground">Total Books</p>
          </div>
        </div>
      </div>
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-md transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <TrendingUpIcon className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {booksInProgress}
            </p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </div>
        </div>
      </div>
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-md transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <StarIcon className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {booksCompleted}
            </p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
        </div>
      </div>
    </div>
  );
}