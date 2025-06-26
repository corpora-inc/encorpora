import React, { PureComponent, type ReactNode } from "react";
import {
  type SwipeableProps,
  type SwipeEventData,
  useSwipeable,
} from "react-swipeable";
import { EpubView, type IEpubViewProps } from "./epub-view";
import {
  ReactReaderStyle as defaultStyles,
  type IReactReaderStyle,
} from "./react-reader-styles";
import { type NavItem } from "epubjs";
import {
  SettingsDialog,
  type ReaderTheme,
  type Settings,
} from "./SettingsDialog";
import { searchInBook } from "./lib";
import { Toc } from "./Toc";

type SwipeWrapperProps = {
  children: ReactNode;
  swipeProps: Partial<SwipeableProps>;
};

const SwipeWrapper = ({ children, swipeProps }: SwipeWrapperProps) => {
  const handlers = useSwipeable(swipeProps);
  return (
    <div style={{ height: "100%" }} {...handlers}>
      {children}
    </div>
  );
};

const themes: ReaderTheme[] = [
  {
    name: "Light",
    styles: {
      body: {
        background: "#fff",
        color: "#000",
      },
    },
  },
  {
    name: "Dark",
    styles: {
      body: {
        background: "#121212",
        color: "#e0e0e0",
      },
    },
  },
  {
    name: "Sepia",
    styles: {
      body: {
        background: "#f4f1e9",
        color: "#5c4b37",
      },
    },
  },
];

export type IReactReaderProps = IEpubViewProps & {
  title?: string;
  showToc?: boolean;
  readerStyles?: IReactReaderStyle;
  swipeable?: boolean;
  isRTL?: boolean;
  pageTurnOnScroll?: boolean;
  searchQuery?: string;
  contextLength?: number;
  onSearchResults?: (results: SearchResult[]) => void;
};

type SearchResult = { cfi: string; excerpt: string };

type IReactReaderState = {
  isLoaded: boolean;
  toc: NavItem[];
  settings: Settings;
};

export class ReactReader extends PureComponent<
  IReactReaderProps,
  IReactReaderState
> {
  state: Readonly<IReactReaderState> = {
    isLoaded: false,
    toc: [],
    settings: {
      fontSize: 100,
      fontFamily: "'Inter', sans-serif",
      fontWeight: "normal",
      lineHeight: 1.5,
      textAlign: "justify",
      spread: "auto",
      theme: "Light",
    },
  };
  readerRef = React.createRef<EpubView>();
  constructor(props: IReactReaderProps) {
    super(props);
  }

  next = () => {
    const node = this.readerRef.current;
    if (node && node.nextPage) {
      node.nextPage();
    }
  };

  prev = () => {
    const node = this.readerRef.current;
    if (node && node.prevPage) {
      node.prevPage();
    }
  };

  onSettingsChange = (newSettings: Partial<Settings>) => {
    this.setState(
      { settings: { ...this.state.settings, ...newSettings } },
      () => {
        this.applySettings();
      }
    );
  };

  applySettings = () => {
    const { settings } = this.state;
    const rendition = this.readerRef.current?.rendition;
    if (!rendition) return;

    const theme = themes.find((t) => t.name === settings.theme);
    if (theme) {
      rendition.themes.register(theme.name, theme.styles);
      rendition.themes.select(theme.name);
    }

    rendition.themes.fontSize(`${settings.fontSize}%`);
    rendition.themes.font(settings.fontFamily);
    rendition.themes.override("font-weight", settings.fontWeight);
    rendition.themes.override("line-height", `${settings.lineHeight}`);
    rendition.themes.override("text-align", settings.textAlign);
    if (rendition.spread) {
      rendition.spread(settings.spread);
    }
  };

  onTocChange = (toc: NavItem[]) => {
    const { tocChanged } = this.props;
    this.setState(
      {
        toc: toc,
      },
      () => {
        tocChanged && tocChanged(toc);
        this.applySettings();
      }
    );
  };

  setLocation = (loc: string) => {
    const { locationChanged } = this.props;
    this.setState(
      () => locationChanged && locationChanged(loc)
    );
  };


  // Changing Page based on direction of scroll
  handleWheel = (event: WheelEvent) => {
    event.preventDefault();

    const node = this.readerRef.current;
    if (!node) return;

    if (event.deltaY > 0) {
      node.nextPage?.();
    } else if (event.deltaY < 0) {
      node.prevPage?.();
    }
  };

  // Setting up event listener in the iframe of the viewer
  attachWheelListener = () => {
    if (!this.readerRef.current) return;

    const rendition = this.readerRef.current.rendition;

    if (rendition) {
      rendition.hooks.content.register(
        (contents: { window: { document: any } }) => {
          const iframeDoc = contents.window.document;

          // Remove any existing listener before adding a new one
          iframeDoc.removeEventListener("wheel", this.handleWheel);
          iframeDoc.addEventListener("wheel", this.handleWheel, {
            passive: false,
          });
        }
      );
    }
  };

  //search function to find all occurence and set amount of charecters for context
  searchInBook = async (query?: string) => {
    if (!this.readerRef.current) return;
    const book = this.readerRef.current?.book;
    if (!book) return;

    if (!query) {
      this.props.onSearchResults?.([]);
      return;
    }

    try {
      const results = await searchInBook(book, query, this.props.contextLength);
      // This check prevents a race condition where an old search result
      // could overwrite a newer one if the user types quickly.
      if (query === this.props.searchQuery) {
        this.props.onSearchResults?.(results);
      }
    } catch (error) {
      console.error("An error occurred during book search:", error);
      this.props.onSearchResults?.([]);
    }
  };

  //Actions to perform when the component updates
  componentDidUpdate(prevProps: IReactReaderProps) {
    //searching only when new search query is passed
    if (prevProps.searchQuery !== this.props.searchQuery) {
      this.searchInBook(this.props.searchQuery);
    }

    //attaching the wheel listner only when pageTurnOnScroll is set as true
    if (this.props.pageTurnOnScroll === true) {
      this.attachWheelListener();
    }
  }

  render() {
    const {
      title,
      showToc = true,
      loadingView,
      readerStyles = defaultStyles,
      locationChanged,
      swipeable,
      isRTL = false,
      pageTurnOnScroll = false,
      searchQuery,
      contextLength,
      ...props
    } = this.props;
    const { toc, settings } = this.state;
    return (
      <div style={readerStyles.container}>
        <div style={Object.assign({}, readerStyles.readerArea)}>
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            {showToc && (
              <Toc
                toc={toc}
                setLocation={this.setLocation}
              />
            )}
          </div>
          <div className="absolute top-4 right-4 z-20">
            <SettingsDialog
              themes={themes}
              settings={settings}
              onSettingsChange={this.onSettingsChange}
            />
          </div>
          <div style={readerStyles.titleArea}>{title}</div>
          <SwipeWrapper
            swipeProps={{
              onSwiped: (eventData: SwipeEventData) => {
                const { dir } = eventData;
                if (dir === "Left") {
                  isRTL ? this.prev() : this.next();
                }
                if (dir === "Right") {
                  isRTL ? this.next() : this.prev();
                }
              },
              onTouchStartOrOnMouseDown: ({ event }) => event.preventDefault(),
              touchEventOptions: { passive: false },
              preventScrollOnSwipe: true,
              trackMouse: true,
            }}
          >
            <div style={readerStyles.reader}>
              <EpubView
                ref={this.readerRef}
                loadingView={
                  loadingView === undefined ? (
                    <div style={readerStyles.loadingView}>Loading…</div>
                  ) : (
                    loadingView
                  )
                }
                {...props}
                tocChanged={this.onTocChange}
                locationChanged={locationChanged}
              />
              {swipeable && <div style={readerStyles.swipeWrapper} />}
            </div>
          </SwipeWrapper>
          <button
            style={Object.assign({}, readerStyles.arrow, readerStyles.prev)}
            onClick={isRTL ? this.next : this.prev}
          >
            ‹
          </button>
          <button
            style={Object.assign({}, readerStyles.arrow, readerStyles.next)}
            onClick={isRTL ? this.prev : this.next}
          >
            ›
          </button>
        </div>
      </div>
    );
  }
}
