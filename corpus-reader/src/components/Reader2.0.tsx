import {
  getBookInformation,
  readFileSrc,
  updateBookProgress,
} from "@/lib/utils";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ReactReader } from "./react-reader/react-reader";

interface ReaderProps {
  onBookRead?: () => void;
}

export const Reader = ({ onBookRead }: ReaderProps) => {
  const [location, setLocation] = useState<string | number | null>(null);
  const [epubFile, setEpubFile] = useState<string | ArrayBuffer | undefined>(
    undefined
  );
  const { bookPath } = useParams<{ bookPath: string }>();

  const locationChanged = async (epubcifi: string) => {
    if (!bookPath) return;
    setLocation(epubcifi);
    await updateBookProgress(bookPath, epubcifi, 10); //Should get a way to extract the progress of the epub....
    if (onBookRead) onBookRead();
  };

  useEffect(() => {
    if (!bookPath) return;
    const getBookInfo = async () => {
      const book = await getBookInformation(bookPath);
      return book;
    };

    // Update the last_read timestamp when book is opened
    const updateLastRead = async () => {
      try {
        await updateBookProgress(bookPath);
        // Refresh the books list to update the UI
        if (onBookRead) {
          onBookRead();
        }
      } catch (error) {
        console.error("Failed to update last_read:", error);
      }
    };

    updateLastRead();
    getBookInfo().then((book) => {
      if (book) {
        setLocation(book.last_read_page);
      }
    });
    readFileSrc(bookPath)
      .then(async (file) => {
        setEpubFile(file);
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
