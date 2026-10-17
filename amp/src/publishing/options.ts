export function parsePublishingArgs(args: readonly string[]): {
  bookId: string;
  outputDirectory: string;
  allPages: boolean;
} {
  let outputDirectory: string | undefined,
    allPages = false,
    bookId: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--book") {
      const value = args[++i];
      if (!value || !/^[a-z0-9][a-z0-9-]*$/.test(value) || bookId)
        throw new Error("Provide exactly one registered book identifier");
      bookId = value;
      continue;
    }
    if (arg === "--all-pages") {
      allPages = true;
      continue;
    }
    if (arg === "--output") {
      const value = args[++i];
      if (!value || value.startsWith("--") || outputDirectory)
        throw new Error("Provide exactly one output directory");
      outputDirectory = value;
      continue;
    }
    if (arg.startsWith("--"))
      throw new Error(`Unknown publisher option: ${arg}`);
    if (outputDirectory)
      throw new Error("Provide exactly one output directory");
    outputDirectory = arg;
  }
  const selectedBook = bookId ?? "fraction-field-guide";
  return {
    bookId: selectedBook,
    outputDirectory: outputDirectory ?? `artifacts/books/${selectedBook}`,
    allPages,
  };
}
