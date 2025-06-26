import { ChevronDown, Menu } from "lucide-react";
import { Button } from "../ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { type NavItem } from "epubjs";

import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "../ui/scroll-area";

type TocItemProps = {
  data: NavItem;
  setLocation: (value: string) => void;
};

const TocItem = ({ data, setLocation }: TocItemProps) => (
  <div className="group">
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between text-sm font-normal text-left h-auto py-2.5 px-3 hover:bg-accent/30 transition-colors duration-150 group rounded-md"
          onClick={() => !data.subitems?.length && setLocation(data.href)}
        >
          <span className="truncate text-foreground/80 group-hover:text-foreground">
            {data.label || "Unknown Chapter"}
          </span>
          {data.subitems && data.subitems.length > 0 && (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-all duration-150 group-data-[state=open]:rotate-180" />
          )}
        </Button>
      </CollapsibleTrigger>
      {data.subitems && data.subitems.length > 0 && (
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="ml-3 mt-1 border-l border-border/30">
            <ul className="space-y-0.5">
              {data.subitems.map((subitem, subIndex) => (
                <li key={subIndex}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-xs h-auto py-2 px-3 text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors duration-150 rounded-md"
                    onClick={() => setLocation(subitem.href)}
                  >
                    <span className="truncate">
                      {subitem.label || "Unknown Section"}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  </div>
);

export const Toc = ({
  toc,
  setLocation,
}: {
  toc: NavItem[];
  setLocation: (value: string) => void;
}) => {
  return (
    <Sheet>
      <SheetTrigger>
        <Button variant="ghost" size="sm">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle> Contents</SheetTitle>
        </SheetHeader>
        <ScrollArea className="max-h-screen w-72 px-3">
          {Array.isArray(toc) && toc.length > 0 ? (
            <div className="space-y-2">
              {toc.map((item, i) => (
                <TocItem data={item} key={i} setLocation={setLocation} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 bg-muted/30 rounded-lg flex items-center justify-center mb-3">
                <Menu className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-xs text-muted-foreground">
                No chapters available
              </p>
            </div>
          )}
        </ScrollArea>
        <SheetFooter>
          {toc.length > 0 && (
            <div className="border-t border-border/30 px-4 py-2">
              <p className="text-xs text-muted-foreground/70 text-center">
                {toc.length} {toc.length === 1 ? "chapter" : "chapters"}
              </p>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
