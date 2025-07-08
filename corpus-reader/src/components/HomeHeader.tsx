import { PlusIcon } from "lucide-react";
import { Button } from "./ui/button";

import BookSearchDialog from "./BookSearchDialog";
import { BookEntry } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import About from "./About";

const HomeHeader = ({
  books,
  handleAddBookToLibrary,
}: {
  books: BookEntry[];
  handleAddBookToLibrary: () => Promise<void>;
}) => {
  return (
    <div className=" bg-background/60 backdrop-blur-sm border-b sticky top-0 z-50">
      <div className="flex h-16 items-center justify-between  container px-4 mx-auto max-w-7xl">
        <div className="flex items-center justify-center ">
          <Avatar className="mr-2 h-10 w-10">
            <AvatarImage src="/logo.png" />
            <AvatarFallback>Logo</AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-bold">Corporium</h1>
        </div>
        <div className="hidden md:block">
          {/* TODO: add bookmarks and notes section */}
        </div>
        <div className="flex items-center space-x-2">
          {/* Search Dialog with debounce */}
          <BookSearchDialog books={books} />
          <About />
          <Button
            onClick={handleAddBookToLibrary}
            size="sm"
            className="h-8 w-auto flex items-center justify-center"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden md:inline ml-1">Add book</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HomeHeader;
