import { useState } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { generatePdfCover } from "@/lib/getPdfCover";

interface FilePickResult {
  message: string;
  file_path: string;
}

export function useAddBook(onBookAdded: () => void) {
  const [loadingBooks, setLoadingBooks] = useState(false);

  const handleAddBookToLibrary = async () => {
    let message = "";
    try {
      setLoadingBooks(true);
      const result = await invoke("pick_file") as FilePickResult;
      message = result.message;

      if (result.file_path.includes("pdf")) {
        await generatePdfCover(result.file_path, result.file_path);
      }
      onBookAdded();
    } catch (error) {
      console.error("Error opening file dialog or adding book:", error);
      toast.error("Could not open or process the EPUB file.");
    } finally {
      setLoadingBooks(false);
      toast.info(message);
    }
  };

  return {
    loadingBooks,
    handleAddBookToLibrary,
  };
}