import React, { Component } from "react";
import Epub, { Book } from "epubjs";
import type { NavItem, Contents, Rendition, Location } from "epubjs";
import type { RenditionOptions } from "epubjs/types/rendition";
import type { BookOptions } from "epubjs/types/book";
import Loader from "../Loader";

export type RenditionOptionsFix = RenditionOptions & {
  allowPopups: boolean;
};

export type IToc = {
  label: string;
  href: string;
};

export type IEpubViewProps = {
  url: string | ArrayBuffer;
  epubInitOptions?: Partial<BookOptions>;
  epubOptions?: Partial<RenditionOptionsFix>;
  location: string | number | null;
  locationChanged(value: string): void;
  showToc?: boolean;
  tocChanged?(value: NavItem[]): void;
  getRendition?(rendition: Rendition): void;
  handleKeyPress?(): void;
  handleTextSelected?(cfiRange: string, contents: Contents): void;
};
type IEpubViewState = {
  isLoaded: boolean;
  toc: NavItem[];
};

export class EpubView extends Component<IEpubViewProps, IEpubViewState> {
  state: Readonly<IEpubViewState> = {
    isLoaded: false,
    toc: [],
  };
  viewerRef = React.createRef<HTMLDivElement>();
  location?: string | number | null;
  book?: Book;
  rendition?: Rendition;
  prevPage?: () => void;
  nextPage?: () => void;
  private initializationPromise?: Promise<void>;

  constructor(props: IEpubViewProps) {
    super(props);
    this.location = props.location;
    this.book = this.rendition = this.prevPage = this.nextPage = undefined;
  }

  componentDidMount() {
    this.initBook();
    document.addEventListener("keyup", this.handleKeyPress, false);
  }

  async initBook() {
  const { url, tocChanged, epubInitOptions } = this.props;
    
    // Cancel any previous initialization
    if (this.initializationPromise) {
      return;
    }

    try {
      // Set loading state
      this.setState({ isLoaded: false, toc: [] });

      this.initializationPromise = new Promise(async (resolve, reject) => {
        try {
          // Clean up previous book
          if (this.book) {
            this.book.destroy();
          }

          // Use setTimeout to defer the heavy operation
          await new Promise(resolve => setTimeout(resolve, 0));

          // Initialize book asynchronously
          this.book = Epub(url, epubInitOptions);
          
          // Wait for navigation to load
          const navigation = await this.book.loaded.navigation;
          
          this.setState(
            {
              isLoaded: true,
              toc: navigation.toc,
            },
            () => {
              tocChanged && tocChanged(navigation.toc);
              this.initReader();
              resolve();
            }
          );
        } catch (error) {
          console.error("Error initializing EPUB:", error);
          // Set error state or retry logic here
          this.setState({
            isLoaded: false,
            toc: [],
          });
          reject(error);
        }
      });

      await this.initializationPromise;
    } catch (error) {
      console.error("Failed to initialize EPUB:", error);
    } finally {
      this.initializationPromise = undefined;
    }
  }

  componentWillUnmount() {
    if (this.book) {
      this.book.destroy();
    }
    this.book = this.rendition = this.prevPage = this.nextPage = undefined;
    document.removeEventListener("keyup", this.handleKeyPress, false);
  }

  shouldComponentUpdate(nextProps: IEpubViewProps) {
    return (
      !this.state.isLoaded ||
      nextProps.location !== this.props.location ||
      nextProps.url !== this.props.url
    );
  }

  componentDidUpdate(prevProps: IEpubViewProps) {
    if (
      prevProps.location !== this.props.location &&
      this.location !== this.props.location
    ) {
      this.rendition?.display(this.props.location + "");
    }
    if (prevProps.url !== this.props.url) {
      this.initBook();
    }
  }

  initReader() {
    const { toc } = this.state;
    const { location, epubOptions, getRendition } = this.props;
    if (this.viewerRef.current) {
      const node = this.viewerRef.current;
      if (this.book) {
        const rendition = this.book.renderTo(node, {
          width: "100%",
          height: "100%",
          ...epubOptions,
        });
        this.rendition = rendition;
        this.prevPage = () => {
          rendition.prev();
        };
        this.nextPage = () => {
          rendition.next();
        };
        this.registerEvents();
        getRendition && getRendition(rendition);

        if (typeof location === "string" || typeof location === "number") {
          rendition.display(location + "");
        } else if (toc.length > 0 && toc[0].href) {
          rendition.display(toc[0].href);
        } else {
          rendition.display();
        }
      }
    }
  }

  registerEvents() {
    const { handleKeyPress, handleTextSelected } = this.props;
    if (this.rendition) {
      this.rendition.on("locationChanged", this.onLocationChange);
      this.rendition.on("keyup", handleKeyPress || this.handleKeyPress);
      if (handleTextSelected) {
        this.rendition.on("selected", handleTextSelected);
      }
    }
  }

  onLocationChange = (loc: Location) => {
    const { location, locationChanged } = this.props;
    const newLocation = `${loc.start}`;
    if (location !== newLocation) {
      this.location = newLocation;
      locationChanged && locationChanged(newLocation);
    }
  };

  handleKeyPress = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight" && this.nextPage) {
      this.nextPage();
    }
    if (event.key === "ArrowLeft" && this.prevPage) {
      this.prevPage();
    }
  };

  render() {
    const { isLoaded } = this.state;
    return (
      <div className="relative h-full w-full" style={{backgroundColor: 'inherit', color: 'inherit'}}>
        {(isLoaded && <div ref={this.viewerRef} className="h-full" style={{backgroundColor: 'inherit'}} />) || (
          <Loader text="loading book" />
        )}
      </div>
    );
  }
}
