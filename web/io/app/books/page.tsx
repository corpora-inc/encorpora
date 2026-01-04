"use client";

import { FC, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

// Define TypeScript types for books
interface Book {
    id: string;
    title: string;
    description: string;
    link: string;
}

const BooksPage: FC = () => {
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchBooks = async () => {
            setLoading(true);
            const { data, error } = await supabase.from("books").select("*");
            if (error) {
                console.error("Error fetching books:", error.message);
            } else {
                setBooks(data);
            }
            setLoading(false);
        };

        fetchBooks();
    }, []);

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6">
            <h1 className="text-4xl font-bold text-center text-gray-900">All Books</h1>
            <p className="text-lg text-gray-700 text-center mt-4 max-w-2xl">
                Download high-quality educational resources for free.
            </p>

            <div className="mt-8 w-full max-w-2xl bg-white shadow-md rounded-lg p-6">
                {loading ? (
                    <p className="text-center text-gray-600">Loading books...</p>
                ) : books.length === 0 ? (
                    <p className="text-center text-gray-600">No books available.</p>
                ) : (
                    books.map((book) => (
                        <div key={book.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 border-b last:border-b-0">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{book.title}</h3>
                                <p className="text-gray-600">{book.description}</p>
                            </div>
                            <a href={book.link} target="_blank" rel="noopener noreferrer">
                                <Button className="mt-3 sm:mt-0">Download</Button>
                            </a>
                        </div>
                    ))
                )}
            </div>

            <footer className="mt-16 text-gray-500 text-sm">
                © {new Date().getFullYear()} Corpora Inc - All Rights Reserved.
            </footer>
        </div>
    );
};

export default BooksPage;
