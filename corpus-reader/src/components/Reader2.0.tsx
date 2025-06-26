import { sample } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ReactReader } from "./react-reader/react-reader";
import { invoke } from "@tauri-apps/api/core";

interface ReaderProps {
  onBookRead?: () => void;
}

export const Reader = ({ onBookRead }: ReaderProps) => {
  const [location, setLocation] = useState<string | number | null>(null);
  const [epubFile, setEpubFile] = useState<ArrayBuffer | undefined>(
    undefined
  );
  const { bookPath } = useParams<{ bookPath: string }>();

  const locationChanged = (epubcifi: string) => {
    setLocation(epubcifi);
  };

  useEffect(() => {
    // This effect runs once when the component mounts
    if (!bookPath) return;
    
    // Update the last_read timestamp when book is opened
    const updateLastRead = async () => {
      try {
        await invoke("update_book_last_read", { bookPath: decodeURIComponent(bookPath) });
        // Refresh the books list to update the UI
        if (onBookRead) {
          onBookRead();
        }
      } catch (error) {
        console.error("Failed to update last_read:", error);
      }
    };
    
    updateLastRead();
    
    sample(bookPath)
      .then((file) => {
        const sss = file.buffer;
        console.log("Loaded book:", bookPath, sss);
        setEpubFile(sss);
        console.log("Epub file set:");
        setLocation(null); // Reset location when a new book is loaded
      })
      .catch((error) => {
        console.error("Error loading book:", error);
      });
  }, [bookPath]);

  return (
    <div style={{ height: "100vh" }}>
      {epubFile && (
        <ReactReader
          location={location}
          locationChanged={locationChanged}
          url={epubFile}
        />
      )}
    </div>
  );
};
