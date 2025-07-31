import { Button } from "@/components/ui/button";
import {
  BookOpenIcon,
  FolderIcon,
  PlusIcon,
  LibraryIcon,
} from "lucide-react";

interface EmptyLibraryStateProps {
  selectedLibrary: string;
  handleAddBookToLibrary: () => void;
  setSelectedLibrary: (library: string) => void;
}

export function EmptyLibraryState({
  selectedLibrary,
  handleAddBookToLibrary,
  setSelectedLibrary,
}: EmptyLibraryStateProps) {
  const getEmptyStateContent = () => {
    switch (selectedLibrary) {
      case "all":
        return {
          icon: <BookOpenIcon className="h-8 w-8 text-muted-foreground" />,
          title: "No books found",
          description: "Try adjusting your filters or add some books to your library.",
        };
      case "favorites":
        return {
          icon: <FolderIcon className="h-8 w-8 text-muted-foreground" />,
          title: "No favorite books yet",
          description: "Mark some books as favorites to see them here.",
        };
      case "currently-reading":
        return {
          icon: <FolderIcon className="h-8 w-8 text-muted-foreground" />,
          title: "No books in progress",
          description: "Start reading a book to track your progress here.",
        };
      case "want-to-read":
        return {
          icon: <FolderIcon className="h-8 w-8 text-muted-foreground" />,
          title: "No books in your wishlist",
          description: "Add books you want to read to this wishlist.",
        };
      default:
        return {
          icon: <FolderIcon className="h-8 w-8 text-muted-foreground" />,
          title: "Library is empty",
          description: "No books match the current filters in this library.",
        };
    }
  };

  const { icon, title, description } = getEmptyStateContent();

  return (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4">{description}</p>
      <div className="flex gap-2 justify-center">
        <Button onClick={handleAddBookToLibrary} className="gap-2">
          <PlusIcon className="h-4 w-4" />
          Add Books
        </Button>
        {selectedLibrary !== "all" && (
          <Button
            variant="outline"
            onClick={() => setSelectedLibrary("all")}
            className="gap-2"
          >
            <LibraryIcon className="h-4 w-4" />
            Browse All Books
          </Button>
        )}
      </div>
    </div>
  );
}