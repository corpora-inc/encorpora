# 🔥 FAIL LOUDLY - THE ONLY WAY TO CODE 🔥

## CORE PRINCIPLE

**IF SOMETHING IS WRONG, THE PROGRAM MUST CRASH IMMEDIATELY AND LOUDLY**

No silent failures. No empty success. No defensive programming. No hiding errors.

---

## THE RULES

### 1. ALWAYS FAIL LOUDLY
- ❌ **NEVER** return empty arrays/objects when there's an error
- ❌ **NEVER** return success when something failed
- ❌ **NEVER** log an error and continue anyway
- ✅ **ALWAYS** throw/return error immediately
- ✅ **ALWAYS** crash the program if it can't continue
- ✅ **ALWAYS** show the full error to the user

### 2. NEVER CATCH EXCEPTIONS (except when you must)
- ❌ **DON'T** catch exceptions "just in case"
- ❌ **DON'T** catch and ignore
- ❌ **DON'T** catch and return empty/null
- ✅ **ONLY** catch for specific known flaky operations (network, external APIs)
- ✅ **ALWAYS** re-throw if you can't actually handle it
- ✅ **LET IT CRASH** if you don't have a recovery strategy

### 3. FAIL AT COMPILE TIME
- ✅ Use strong types
- ✅ Make invalid states unrepresentable
- ✅ Use TypeScript strict mode
- ✅ Use Rust's type system to prevent errors
- ✅ Fail at build time, not runtime
- ✅ Don't even compile if types are wrong

### 4. VALIDATE IMMEDIATELY
- ✅ Check return values
- ✅ Assert non-null
- ✅ Validate array length > 0
- ✅ Check file size > 0
- ❌ **NEVER** assume it worked
- ❌ **NEVER** trust success without verification

### 5. DUMP EVERYTHING ON FAILURE
- ✅ Show full error message
- ✅ Show stack trace
- ✅ Show all relevant state
- ✅ Show what was expected vs what happened
- ✅ Make debugging easy by showing EVERYTHING

---

## EXAMPLES

### ❌ BAD (Silent Failure)
```typescript
try {
  const result = await someOperation();
  // Assume it worked
  return { success: true };
} catch (error) {
  console.error('Error:', error);
  return { success: true }; // LIES!
}
```

### ✅ GOOD (Loud Failure)
```typescript
const result = await someOperation();

if (!result || result.length === 0) {
  throw new Error(`Operation failed: expected data but got ${result}`);
}

return result;
```

### ❌ BAD (Defensive)
```rust
let bytes = create_zip().unwrap_or_default(); // Returns empty vec on error
// Continues with empty vec!
```

### ✅ GOOD (Crash)
```rust
let bytes = create_zip()
    .map_err(|e| format!("ZIP creation failed: {}", e))?;

if bytes.is_empty() {
    return Err("Created ZIP is empty - this should never happen!".to_string());
}
```

---

## WHEN TO CATCH

**ONLY catch exceptions for:**
1. **Network requests** - retry logic, timeouts
2. **External APIs** - rate limiting, service down
3. **User input validation** - show user-friendly error
4. **Known flaky operations** - with specific recovery strategy

**DO NOT catch for:**
- Database operations (if DB is broken, crash)
- File operations (if file can't be written, crash)
- Internal logic errors (crash immediately)
- Null pointer / undefined (fix the code, don't catch)

---

## THE PHILOSOPHY

> "It is better to crash than to silently produce wrong results"

> "If you can't continue correctly, don't continue at all"

> "An error message is better than corrupt data"

> "A crash in development prevents a disaster in production"

> "Make the program yell at you so you fix it"

---

## CHECKLIST FOR EVERY FUNCTION

- [ ] Does it return an error if something goes wrong?
- [ ] Does it validate its inputs?
- [ ] Does it check its outputs before returning?
- [ ] Does it throw/return error instead of empty data?
- [ ] Does it crash instead of continuing with bad state?
- [ ] Will it fail at compile time if used incorrectly?

---

## REMEMBER

**The worst bug is the one that looks like it succeeded.**

A 0-byte file with "success!" is worse than a crash with an error message.

Silent failures waste hours of debugging.

Loud failures save time and prevent disasters.

**FAIL. LOUDLY. ALWAYS.**

---

*This document exists because I forgot this principle and created code that lied about success.*

*Never again.*
