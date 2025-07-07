import Database from "@tauri-apps/plugin-sql";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { convertFileSrc } from "@tauri-apps/api/core";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const readFileSrc = async (path: string) => {
  const assetUrl = convertFileSrc(path);
  return assetUrl;
};

export const removeBookFromLibrary = async (bookId: number) => {
  // Changed bookPath to bookId for consistency
  const db = await Database.load("sqlite:library.db");
  try {
    await db.execute("DELETE FROM books WHERE id = $1", [bookId]);
    // Related bookmarks, highlights, and notes will be deleted automatically
    // if ON DELETE CASCADE is set up correctly in the schema.
    console.log(`Book with ID ${bookId} removed from library.`);
  } catch (error) {
    console.error(`Error removing book with ID ${bookId}:`, error);
  }
};

export const getLibrary = async (): Promise<BookEntry[]> => {
  const db = await Database.load("sqlite:library.db");
  try {
    const books: BookEntry[] = await db.select(
      "SELECT * FROM books ORDER BY last_read DESC"
    );
    return books;
  } catch (error) {
    console.error("Error fetching library:", error);
    return [];
  }
};

export interface BookEntry {
  id: number;
  title: string;
  author: string;
  progress: number;
  last_read: string; // DATETIME as string
  last_read_page: number;
  cover_path: string | null;
  lang: string | null;
  path: string;
  is_finished: boolean;
  added_to_library_at: string; // DATETIME as string
  publisher: string | null;
  publication_date: string | null;
  rating: number;
}

export interface BookmarkEntry {
  id: number;
  book_id: number;
  cfi: string;
  page_number: number | null;
  name: string | null;
  created_at: string; // DATETIME as string
}

export interface HighlightEntry {
  id: number;
  book_id: number;
  cfi_range: string;
  color: string | null;
  note: string | null;
  created_at: string; // DATETIME as string
}

export interface NoteEntry {
  id: number;
  book_id: number;
  cfi: string | null;
  page_number: number | null;
  title: string | null;
  content: string;
  created_at: string; // DATETIME as string
  updated_at: string; // DATETIME as string
}

export const updateBookProgress = async (
  path: string,
  lastReadPage?: string | number | null,
  progress?: string | number | null,

) => {
  const db = await Database.load("sqlite:library.db");
  try {
    await db.execute(
      "UPDATE books SET progress = $1, last_read_page = $2, last_read = CURRENT_TIMESTAMP WHERE path = $3",
      [progress, lastReadPage, path]
    );
    console.log(`Progress updated for book  ${path}.`);
  } catch (error) {
    console.error(`Error updating progress for book ${path}:`, error);
  }
};

export const getBookInformation = async (bookPath: string): Promise<BookEntry | null> => {
  const db = await Database.load("sqlite:library.db");
  try {
    const book: BookEntry[] = await db.select(
      "SELECT * FROM books WHERE path = $1",
      [bookPath]
    );
    if (book.length > 0) {
      return book[0];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching book information for ${bookPath}:`, error);
    return null;
  }
}

export const markBookAsFinished = async (
  bookId: number,
  finished: boolean = true
) => {
  const db = await Database.load("sqlite:library.db");
  try {
    await db.execute("UPDATE books SET is_finished = $1 WHERE id = $2", [
      finished,
      bookId,
    ]);
    console.log(
      `Book ID ${bookId} marked as ${finished ? "finished" : "unfinished"}.`
    );
  } catch (error) {
    console.error(`Error marking book ID ${bookId} as finished:`, error);
  }
};

// --- Bookmark Functions ---
export const addBookmark = async (
  bookId: number,
  cfi: string,
  pageNumber?: number,
  name?: string
): Promise<number | null> => {
  const db = await Database.load("sqlite:library.db");
  try {
    const result = await db.execute(
      "INSERT INTO bookmarks (book_id, cfi, page_number, name) VALUES ($1, $2, $3, $4) RETURNING id",
      [bookId, cfi, pageNumber, name]
    );
    if (result.rowsAffected > 0 && result.lastInsertId) {
      console.log(`Bookmark added for book ID ${bookId} at CFI ${cfi}.`);
      return result.lastInsertId;
    }
    return null;
  } catch (error) {
    console.error(`Error adding bookmark for book ID ${bookId}:`, error);
    return null;
  }
};

export const removeBookmark = async (bookmarkId: number) => {
  const db = await Database.load("sqlite:library.db");
  try {
    await db.execute("DELETE FROM bookmarks WHERE id = $1", [bookmarkId]);
    console.log(`Bookmark ID ${bookmarkId} removed.`);
  } catch (error) {
    console.error(`Error removing bookmark ID ${bookmarkId}:`, error);
  }
};

export const getBookmarks = async (
  bookId: number
): Promise<BookmarkEntry[]> => {
  const db = await Database.load("sqlite:library.db");
  try {
    const bookmarks: BookmarkEntry[] = await db.select(
      "SELECT * FROM bookmarks WHERE book_id = $1 ORDER BY created_at DESC",
      [bookId]
    );
    return bookmarks;
  } catch (error) {
    console.error(`Error fetching bookmarks for book ID ${bookId}:`, error);
    return [];
  }
};

// --- Highlight Functions ---
export const addHighlight = async (
  bookId: number,
  cfiRange: string,
  color?: string,
  note?: string
): Promise<number | null> => {
  const db = await Database.load("sqlite:library.db");
  try {
    const result = await db.execute(
      "INSERT INTO highlights (book_id, cfi_range, color, note) VALUES ($1, $2, $3, $4) RETURNING id",
      [bookId, cfiRange, color, note]
    );
    if (result.rowsAffected > 0 && result.lastInsertId) {
      console.log(`Highlight added for book ID ${bookId}.`);
      return result.lastInsertId;
    }
    return null;
  } catch (error) {
    console.error(`Error adding highlight for book ID ${bookId}:`, error);
    return null;
  }
};

export const removeHighlight = async (highlightId: number) => {
  const db = await Database.load("sqlite:library.db");
  try {
    await db.execute("DELETE FROM highlights WHERE id = $1", [highlightId]);
    console.log(`Highlight ID ${highlightId} removed.`);
  } catch (error) {
    console.error(`Error removing highlight ID ${highlightId}:`, error);
  }
};

export const getHighlights = async (
  bookId: number
): Promise<HighlightEntry[]> => {
  const db = await Database.load("sqlite:library.db");
  try {
    const highlights: HighlightEntry[] = await db.select(
      "SELECT * FROM highlights WHERE book_id = $1 ORDER BY created_at DESC",
      [bookId]
    );
    return highlights;
  } catch (error) {
    console.error(`Error fetching highlights for book ID ${bookId}:`, error);
    return [];
  }
};

export const updateHighlight = async (
  highlightId: number,
  color?: string,
  note?: string
) => {
  const db = await Database.load("sqlite:library.db");
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (color !== undefined) {
    updates.push(`color = $${paramIndex++}`);
    values.push(color);
  }
  if (note !== undefined) {
    updates.push(`note = $${paramIndex++}`);
    values.push(note);
  }

  if (updates.length === 0) {
    console.log("No updates to perform for highlight.");
    return;
  }

  values.push(highlightId); // For the WHERE clause

  try {
    await db.execute(
      `UPDATE highlights SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      values
    );
    console.log(`Highlight ID ${highlightId} updated.`);
  } catch (error) {
    console.error(`Error updating highlight ID ${highlightId}:`, error);
  }
};

// --- Note Functions ---
export const addNote = async (
  bookId: number,
  content: string,
  cfi?: string,
  pageNumber?: number,
  title?: string
): Promise<number | null> => {
  const db = await Database.load("sqlite:library.db");
  try {
    const result = await db.execute(
      "INSERT INTO notes (book_id, cfi, page_number, title, content, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING id",
      [bookId, cfi, pageNumber, title, content]
    );
    if (result.rowsAffected > 0 && result.lastInsertId) {
      console.log(`Note added for book ID ${bookId}.`);
      return result.lastInsertId;
    }
    return null;
  } catch (error) {
    console.error(`Error adding note for book ID ${bookId}:`, error);
    return null;
  }
};

export const removeNote = async (noteId: number) => {
  const db = await Database.load("sqlite:library.db");
  try {
    await db.execute("DELETE FROM notes WHERE id = $1", [noteId]);
    console.log(`Note ID ${noteId} removed.`);
  } catch (error) {
    console.error(`Error removing note ID ${noteId}:`, error);
  }
};

export const updateNote = async (
  noteId: number,
  content: string,
  title?: string
) => {
  const db = await Database.load("sqlite:library.db");
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(title);
  }
  updates.push(`content = $${paramIndex++}`);
  values.push(content);
  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  values.push(noteId); // For the WHERE clause

  try {
    await db.execute(
      `UPDATE notes SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      values
    );
    console.log(`Note ID ${noteId} updated.`);
  } catch (error) {
    console.error(`Error updating note ID ${noteId}:`, error);
  }
};

export const getNotes = async (bookId: number): Promise<NoteEntry[]> => {
  const db = await Database.load("sqlite:library.db");
  try {
    const notes: NoteEntry[] = await db.select(
      "SELECT * FROM notes WHERE book_id = $1 ORDER BY updated_at DESC",
      [bookId]
    );
    return notes;
  } catch (error) {
    console.error(`Error fetching notes for book ID ${bookId}:`, error);
    return [];
  }
};
