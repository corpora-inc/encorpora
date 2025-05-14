import csv


def load_wordlist(path):
    """
    Load words and their CEFR levels from a CSV file.

    Args:
        path (str): The file path to the CSV.

    Returns:
        List[Tuple[str, str]]: A list of tuples containing the word and its CEFR level.
    """
    with open(path, newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        return [(row["word"], row["level"]) for row in reader]
