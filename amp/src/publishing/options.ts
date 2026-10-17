export function parsePublishingArgs(args: readonly string[]): {
  outputDirectory: string;
  allPages: boolean;
} {
  let outputDirectory: string | undefined,
    allPages = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
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
  return {
    outputDirectory: outputDirectory ?? "artifacts/books/fraction-field-guide",
    allPages,
  };
}
