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
import { searchInBook } from "./lib";
import { Toc } from "./Toc";
import { THEMES } from "./settings/ThemeSettings";
import { Settings, SettingsComponent } from "./settings/SettingsComponent";
import { SearchComponent, type SearchResult } from "./SearchComponent";
import { Button } from "../ui/button";
import { ArrowLeft, SettingsIcon } from "lucide-react";
import { ThemeProviderContext } from "@/components/ThemeProvider";
import { useSettingsStore } from "@/store/useSettingsStore";
import DrawerDialog from "../DrawerDialogWrapper";

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
const themes = THEMES;

type IReactReaderState = {
  isLoaded: boolean;
  toc: NavItem[];
  settings: Settings;
  searchResults: SearchResult[];
  isSearching: boolean;
};

export class ReactReader extends PureComponent<
  IReactReaderProps,
  IReactReaderState
> {
  // unsubscribe function for settings store subscription
  unsubscribeSettings?: () => void;
  static contextType = ThemeProviderContext;
  declare context: React.ContextType<typeof ThemeProviderContext>;

  state: Readonly<IReactReaderState> = {
    isLoaded: false,
    toc: [],
    searchResults: [],
    isSearching: false,
    settings: {
      fontSize: 100,
      fontFamily: "'Inter', sans-serif",
      fontWeight: "normal",
      lineHeight: 1.5,
      textAlign: "justify",
      spread: "auto",
      theme: "light",
    },
  };
  readerRef = React.createRef<EpubView>();
  constructor(props: IReactReaderProps) {
    super(props);
    // Initialize settings from persistent store
    const stored = useSettingsStore.getState().settings;
    this.state = {
      ...this.state,
      settings: stored,
    };
    // Initialize reader theme from global theme context
    const globalTheme = this.context?.theme;
    if (globalTheme && globalTheme !== "system") {
      this.state = {
        ...this.state,
        settings: { ...this.state.settings, theme: globalTheme },
      };
    }
  }

  componentDidMount() {
    const { theme: globalTheme } = this.context;
    if (
      globalTheme &&
      globalTheme !== "system" &&
      globalTheme !== this.state.settings.theme
    ) {
      this.setState(
        { settings: { ...this.state.settings, theme: globalTheme } },
        () => this.applySettings()
      );
    }
    // Apply initial settings
    this.applySettings();
    // Subscribe to settings store updates
    this.unsubscribeSettings = useSettingsStore.subscribe((state: any) => {
      const settings = state.settings;
      this.setState({ settings }, () => {
        this.applySettings();
      });
    });
  }
  componentWillUnmount() {
    this.unsubscribeSettings?.();
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

    const theme = themes.find((t) => t.name === settings.theme);

    // Apply theme to the entire component
    if (theme) {
      // Apply theme to rendition if available
      if (rendition) {
        rendition.themes.register(theme.name, theme.styles);
        rendition.themes.select(theme.name);
      }

      // Apply theme colors as CSS custom properties to the document root
      // This allows all child components to inherit the theme colors

      document.documentElement.style.setProperty(
        "--reader-text-color",
        theme.styles.body.color
      );

      // Apply theme to the component container and all child elements
      const containerElement = document.querySelector(
        "[data-react-reader-container]"
      ) as HTMLElement;
      if (containerElement) {
        containerElement.style.color = theme.styles.body.color;

        // Create a style element for scoped CSS rules
        let styleElement = document.getElementById("react-reader-theme-styles");
        if (!styleElement) {
          styleElement = document.createElement("style");
          styleElement.id = "react-reader-theme-styles";
          document.head.appendChild(styleElement);
        }

        // Apply theme-specific CSS rules for child components
        styleElement.textContent = `
          [data-react-reader-container] {
            color: ${theme.styles.body.color} !important;
          }
          
          [data-react-reader-container] .text-foreground,
          [data-react-reader-container] .text-foreground\\/80 {
            color: ${theme.styles.body.color} !important;
          }
          
          [data-react-reader-container] .text-muted-foreground {
            color: ${theme.styles.body.color}80 !important;
          }
          
          [data-react-reader-container] button {
            color: ${theme.styles.body.color} !important;
          }
          
          [data-react-reader-container] svg {
            color: ${theme.styles.body.color} !important;
          }
        `;
      }
    }

    // Apply other settings to rendition if available
    if (rendition) {
      rendition.themes.fontSize(`${settings.fontSize}%`);
      rendition.themes.font(settings.fontFamily);
      rendition.themes.override("font-weight", settings.fontWeight);
      rendition.themes.override("line-height", `${settings.lineHeight}`);
      rendition.themes.override("text-align", settings.textAlign);
      if (rendition.spread) {
        rendition.spread(settings.spread);
      }
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
    this.setState(() => locationChanged && locationChanged(loc));
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
      this.setState({ searchResults: [], isSearching: false });
      this.props.onSearchResults?.([]);
      return;
    }

    this.setState({ isSearching: true });

    try {
      const results = await searchInBook(book, query, this.props.contextLength);
      this.setState({ searchResults: results, isSearching: false });
      this.props.onSearchResults?.(results);
    } catch (error) {
      console.error("An error occurred during book search:", error);
      this.setState({ searchResults: [], isSearching: false });
      this.props.onSearchResults?.([]);
    }
  };

  // Handle clicking on search result
  handleSearchResultClick = (cfi: string) => {
    const node = this.readerRef.current;
    if (node && node.rendition) {
      // Navigate to the search result location
      node.rendition.display(cfi).then(() => {
        // Add highlight after navigation is complete
        this.highlightSearchResult(cfi);
      });
    }
  };

  // Highlight the search result for 2 seconds
  highlightSearchResult = (cfi: string) => {
    const rendition = this.readerRef.current?.rendition;
    if (!rendition) return;

    try {
      // Remove any existing highlights first
      rendition.annotations.remove(cfi, "highlight");

      // Add highlight annotation
      rendition.annotations.add("highlight", cfi, {}, undefined, "hl", {
        fill: "yellow",
        "fill-opacity": "0.3",
        "mix-blend-mode": "multiply",
      });

      // Remove highlight after 2 seconds
      setTimeout(() => {
        try {
          rendition.annotations.remove(cfi, "highlight");
        } catch (error) {
          console.warn("Could not remove highlight:", error);
        }
      }, 2000);
    } catch (error) {
      console.warn("Could not add highlight:", error);
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
      readerStyles = defaultStyles,
      locationChanged,
      swipeable,
      isRTL = false,
      pageTurnOnScroll = false,
      ...props
    } = this.props;
    const { toc, settings } = this.state;

    // Get current theme colors
    const currentTheme = themes.find((t) => t.name === settings.theme);
    const themeColors = currentTheme
      ? currentTheme.styles.body
      : { background: "#fff", color: "#000" };

    // Create themed styles
    const themedContainerStyle = {
      ...readerStyles.container,
      backgroundColor: themeColors.background,
      color: themeColors.color,
    };

    const themedReaderAreaStyle = {
      ...readerStyles.readerArea,
      backgroundColor: themeColors.background,
      color: themeColors.color,
    };

    return (
      <div style={themedContainerStyle} data-react-reader-container>
        <div style={themedReaderAreaStyle}>
          <div
            className="absolute top-4 left-4 z-20 flex items-center gap-2"
            style={{ color: themeColors.color }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            {showToc && <Toc toc={toc} setLocation={this.setLocation} />}
          </div>
          <div
            className="absolute top-4 right-4 z-20 flex items-center gap-2"
            style={{ color: themeColors.color }}
          >
            <SearchComponent
              onSearch={this.searchInBook}
              searchResults={this.state.searchResults}
              onResultClick={this.handleSearchResultClick}
              isLoading={this.state.isSearching}
            />
            <DrawerDialog
              title="Settings"
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-md p-0"
                >
                  <SettingsIcon className="h-4 w-4" />
                </Button>
              }
            >
              <SettingsComponent />
            </DrawerDialog>
          </div>
          <div style={{ ...readerStyles.titleArea, color: themeColors.color }}>
            {title}
          </div>
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
            <div
              style={{
                ...readerStyles.reader,
                backgroundColor: themeColors.background,
              }}
            >
              <EpubView
                ref={this.readerRef}
                {...props}
                tocChanged={this.onTocChange}
                locationChanged={locationChanged}
              />
              <div style={readerStyles.swipeWrapper} />
            </div>
          </SwipeWrapper>
        </div>
      </div>
    );
  }
}
