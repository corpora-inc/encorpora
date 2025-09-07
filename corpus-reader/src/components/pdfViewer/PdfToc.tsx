import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "../ui/button";
import { BookOpen, Menu } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Document, Page } from "react-pdf";

interface PdfTocProps {
  goToPage: (pageNumber: number) => void;
  numPages: number | null;
  currentPage: number;
  rotation: number;
  file: string | null;
}

const PdfToc = ({
  goToPage,
  numPages,
  currentPage,
  rotation,
  file,
}: PdfTocProps) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Table of Contents
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-full mt-4">
          <div className="space-y-2 pr-4">
            {numPages &&
              Array.from({ length: numPages }, (_, i) => i + 1).map(
                (pageNum) => (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "ghost"}
                    className="w-full justify-start h-auto p-3"
                    onClick={() => goToPage(pageNum)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-10 rounded border overflow-hidden flex-shrink-0">
                        <Document file={file}>
                          <Page
                            pageNumber={pageNum}
                            scale={0.15}
                            rotate={rotation}
                            loading={
                              <div className="w-full h-full bg-muted rounded flex items-center justify-center text-xs">
                                {pageNum}
                              </div>
                            }
                            className="w-full h-full object-cover"
                          />
                        </Document>
                      </div>
                      <div className="text-left">
                        <div className="font-medium">Page {pageNum}</div>
                        <div className="text-xs text-muted-foreground">
                          Click to navigate
                        </div>
                      </div>
                    </div>
                  </Button>
                )
              )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default PdfToc;
