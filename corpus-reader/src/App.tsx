import { useState, useEffect } from "react";
import "./App.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { HomeScreen } from "@/components/HomeScreen";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { BookEntry, getLibrary } from "./lib/utils";
import Loader from "./components/Loader";
import { Reader } from "./components/Reader2.0";
import { ThemeProvider } from "./components/ThemeProvider";
import BasicPdfRender  from "./components/BasicPdfRender";

function AppContent() {
  const [Books, setBooks] = useState<BookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const location = useLocation();

  const fetchBooks = async () => {
    setIsLoading(true);
    try {
      const books = await getLibrary();
      setBooks(books);
    } catch (err) {
      toast.error("Failed to load recent books.");
      setBooks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
    setHasInitialized(true);
  }, []);

  // Refetch books when returning to home route (but not on initial load)
  useEffect(() => {
    if (hasInitialized && location.pathname === "/") {
      fetchBooks();
    }
  }, [location.pathname, hasInitialized]);

  if (isLoading && Books.length === 0) {
    return <Loader text="Loading book..." />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Routes>
        <Route
          path="/"
          element={<HomeScreen books={Books} onBookAdded={fetchBooks} onBookDeleted={fetchBooks} />}
        />
        <Route path="/reader/:bookPath" element={<Reader onBookRead={fetchBooks} />} />
        <Route path="/pdf/:bookPath" element={<BasicPdfRender />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Toaster richColors />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

export default App;
