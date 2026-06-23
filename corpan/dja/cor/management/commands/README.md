# Django Management Commands

## Overview

These are **production management commands** for Corpán, a language learning application. These commands process tens of thousands of translations, generate content, and maintain data quality across 30+ languages.

**This is not example code. This is mission-critical production software.**

## Standards & Requirements

### 1. CLI Output Quality

❌ **NEVER DO THIS:**
```python
print("Processing entry in ONE LLM call...")  # Repeated 10,000 times
print("Now we are going to save to database...")  # Implementation details nobody cares about
print("Done!")  # No useful information
```

✅ **ALWAYS DO THIS:**
```python
# Start: Show what's about to happen
print(f"Processing {total} entries in {batches} batches")
print(f"Batch size: {size} | Processes: {procs} | Provider: {provider}")

# Progress: Show batch/total, entries, rate
print(f"✓ Batch {n}/{total} | {count} entries | {time}s | {rate} entries/sec")

# Failures: Immediately visible
print(f"✗ Batch {n}/{total} FAILED")

# Completion: Clear summary
print(f"✅ COMPLETE | {total} entries | {elapsed}s | {rate} entries/sec")
```

**Why this matters:**
- Cost control: User can see if something is stuck and wasting money
- Confidence: Clear progress prevents "is this broken?" anxiety
- Debugging: Failures are immediately visible
- Performance tracking: Real-time rate monitoring

### 2. Code Simplicity

❌ **NEVER DO THIS:**
```python
# Overcomplicated data structures
batch: List[Tuple[int, int, int, str, str, str, str]]  # What is this?
# (entry_id, guru_id, arab_id, english, gurmukhi, shahmukhi, romanization)

# Passing IDs you don't need
def process(guru_id, arab_id, ...):  # Why pass these through?
    # ... later lookup by ID anyway
```

✅ **ALWAYS DO THIS:**
```python
# Simple, self-documenting structures
batch: List[Tuple[int, str, str, str, str]]
# (entry_id, english, gurmukhi, shahmukhi, romanization)

# Look up what you need, when you need it
def process(entry_id, text_data, ...):
    translations = Translation.objects.filter(entry_id=entry_id, language=lang)
```

**Why this matters:**
- Readability: Next developer understands immediately
- Maintainability: Less coupling, easier to change
- Correctness: Fewer places for bugs to hide

### 3. Performance & Batching

**LLM Batch Processing:**
```python
# ✓ Batch multiple entries in ONE LLM call
def process_batch(entries: List[...]) -> List[Result]:
    # Format: "123:\nField: value\n\n124:\nField: value\n..."
    result = llm.get_data_completion(messages, ResponseModel)
    return result.items  # List of results

# NOT one-at-a-time:
# for entry in entries:
#     result = llm.get_data_completion(...)  # 10x slower, 10x more expensive
```

**Multiprocessing:**
```python
# Use multiprocessing.Pool for parallel execution
pool = multiprocessing.Pool(processes=cpu_count)
for batch in batches:
    pool.apply_async(worker, args=(batch, ...))
pool.close()
pool.join()
```

**Why this matters:**
- Cost: 10 entries in 1 call vs 10 calls = 10x cheaper
- Speed: Parallel processing = 8x faster on 8 cores
- Efficiency: 27K entries in 15 minutes, not 15 hours

### 4. Database Efficiency

✅ **Use bulk operations:**
```python
# Bulk queries
translations = {t.entry_id: t for t in Translation.objects.filter(entry_id__in=ids)}

# Bulk updates
Translation.objects.bulk_update(objects, ['text', 'romanization'], batch_size=1000)

# Bulk creates
Translation.objects.bulk_create(objects, batch_size=1000)
```

❌ **Never do this in a loop:**
```python
for entry_id in entry_ids:
    t = Translation.objects.get(entry_id=entry_id)  # N queries!
    t.save()  # N saves!
```

### 5. Error Handling

**Production commands must:**
- Handle LLM failures gracefully (log and continue)
- Report which batches failed (with batch numbers)
- Never silently skip errors
- Provide enough info to debug failures

```python
try:
    result = llm.get_data_completion(...)
except Exception as e:
    print(f"✗ Batch {n}/{total} FAILED: {e}")
    return  # Don't crash the whole run
```

### 6. Dry Run Mode

**Every data-modification command MUST have `--dry-run`:**
```python
parser.add_argument('--dry-run', action='store_true',
                   help='Show what would be changed without saving')

if dry:
    # Show changes clearly
    print(f"Would update: {old} → {new}")
else:
    # Actually save
    obj.save()
```

**Why this matters:**
- Safety: Preview before running on 27K entries
- Confidence: Verify logic before committing
- Debugging: Test without side effects

## Command Categories

### Translation & Romanization
- `translate_missing.py` - Fill missing translations using LLM (batch processing)
- `romanize_*.py` - Generate ISO 15919 romanizations for various scripts
- `refine_punjabi.py` - LLM-based quality refinement for Punjabi (Gurmukhi + Shahmukhi)

### Script Conversion
- `convert_gurmukhi_to_shahmukhi.py` - Convert Gurmukhi to Shahmukhi script using Aksharamukha

### Data Management
- Various pack generation and data import commands

## Testing Your Command

Before committing:

1. **Test with `--dry-run` and `--limit 10`**
   ```bash
   python manage.py yourcommand --dry-run --limit 10
   ```

2. **Test with small batch on real data**
   ```bash
   python manage.py yourcommand --limit 100
   ```

3. **Verify output quality:**
   - Clear progress indicators?
   - Failures reported?
   - Rate/performance visible?
   - Clean completion summary?

4. **Check performance:**
   - Using bulk queries/updates?
   - Batching LLM calls?
   - Multiprocessing when appropriate?

## Common Patterns

### LLM Batch Processing with Pydantic

```python
from pydantic import BaseModel
from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider

class ResultItem(BaseModel):
    entry_id: int
    output: str

class BatchResponse(BaseModel):
    results: List[ResultItem]

def process_batch(batch, llm):
    # Format entries
    entries_text = [f"{id}:\nInput: {text}" for id, text in batch]

    messages = [
        ChatCompletionTextMessage(role="system", text=PROMPT),
        ChatCompletionTextMessage(role="user", text="\n\n".join(entries_text)),
    ]

    return llm.get_data_completion(messages, BatchResponse)
```

### Multiprocessing Worker

```python
def worker(batch, provider, dry_run, batch_num, total_batches):
    close_old_connections()  # REQUIRED for Django + multiprocessing

    llm = load_llm_provider(provider)
    result = process_batch(batch, llm)

    if not dry_run:
        # Save to database
        pass

    print(f"✓ Batch {batch_num}/{total_batches} | {len(batch)} entries")
```

### Main Handler Pattern

```python
def handle(self, *args, **opts):
    # 1. Collect work items
    work_items = [(id, text, ...) for ...]

    # 2. Calculate batches
    batches = list(_batched(work_items, batch_size))
    total_batches = len(batches)

    # 3. Show what's about to happen
    print(f"Processing {len(work_items)} items in {total_batches} batches")

    # 4. Process with multiprocessing
    pool = multiprocessing.Pool(processes=processes)
    for n, batch in enumerate(batches, 1):
        pool.apply_async(worker, args=(batch, ..., n, total_batches))
    pool.close()
    pool.join()

    # 5. Summary
    print(f"✅ COMPLETE | {total} entries | {elapsed}s")
```

## Remember

> "BUILD TOP QUALITY, SIMPLE, USEFUL SOFTWARE, NOT USELESS EXAMPLES. This is production of an extremely important app."

- Users need to track progress and cost
- Next developers need to understand your code
- Simple is better than clever
- Performance matters
- Output quality matters

When in doubt, look at `refine_punjabi.py` as a reference implementation of these standards.
