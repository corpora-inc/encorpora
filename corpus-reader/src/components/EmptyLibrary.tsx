import { BookTextIcon, PlusIcon } from "lucide-react";
import { Button } from "./ui/button";

const EmptyLibrary = ({
  handleAddBookToLibrary,
}: {
  handleAddBookToLibrary: () => void;
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 md:p-16 mt-12 border-2 border-dashed border-muted-foreground/20 rounded-xl bg-muted/10">
      <div className="w-24 h-24 mb-6 text-muted-foreground/50">
        <BookTextIcon className="w-full h-full" />
      </div>
      <h3 className="text-xl font-semibold mb-2 text-foreground">
        Your library is empty
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md text-center">
        Start your reading journey by adding your first file to your collection.
      </p>
      <Button
        size="lg"
        onClick={handleAddBookToLibrary}
        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all duration-300 hover:scale-105"
      >
        <PlusIcon className="" />
        Add your first file
      </Button>
    </div>
  );
};


export default EmptyLibrary;