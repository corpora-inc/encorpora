/// Reliable file type detection from magic bytes (file signatures)
/// This works on all platforms and doesn't rely on file extensions or MIME types

pub fn detect_extension_from_bytes(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() < 16 {
        return None;
    }

    // JPEG (FF D8 FF)
    if bytes.len() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
        return Some("jpg");
    }

    // PNG (89 50 4E 47 0D 0A 1A 0A)
    if bytes.len() >= 8
        && bytes[0] == 0x89
        && bytes[1] == 0x50
        && bytes[2] == 0x4E
        && bytes[3] == 0x47
        && bytes[4] == 0x0D
        && bytes[5] == 0x0A
        && bytes[6] == 0x1A
        && bytes[7] == 0x0A
    {
        return Some("png");
    }

    // GIF (47 49 46 38)
    if bytes.len() >= 4
        && bytes[0] == 0x47
        && bytes[1] == 0x49
        && bytes[2] == 0x46
        && bytes[3] == 0x38
    {
        return Some("gif");
    }

    // WEBP (52 49 46 46 ... 57 45 42 50)
    if bytes.len() >= 12
        && bytes[0] == 0x52
        && bytes[1] == 0x49
        && bytes[2] == 0x46
        && bytes[3] == 0x46
        && bytes[8] == 0x57
        && bytes[9] == 0x45
        && bytes[10] == 0x42
        && bytes[11] == 0x50
    {
        return Some("webp");
    }

    // PDF (25 50 44 46)
    if bytes.len() >= 4
        && bytes[0] == 0x25
        && bytes[1] == 0x50
        && bytes[2] == 0x44
        && bytes[3] == 0x46
    {
        return Some("pdf");
    }

    // MP4/M4V/MOV (checks for 'ftyp' box)
    if bytes.len() >= 12 && bytes[4] == 0x66 && bytes[5] == 0x74 && bytes[6] == 0x79 && bytes[7] == 0x70 {
        // Check specific MP4 brands
        // 'isom', 'mp41', 'mp42', 'M4V ', 'M4A ', 'qt  '
        if bytes.len() >= 16 {
            let brand = &bytes[8..12];
            // MP4 variants
            if brand == b"isom" || brand == b"mp41" || brand == b"mp42" || brand == b"iso2" {
                return Some("mp4");
            }
            // M4V (iTunes video)
            if brand == b"M4V " || brand == b"M4VH" || brand == b"M4VP" {
                return Some("m4v");
            }
            // MOV (QuickTime)
            if brand == b"qt  " {
                return Some("mov");
            }
            // M4A (audio)
            if brand == b"M4A " {
                return Some("m4a");
            }
            // Default to MP4 for ftyp
            return Some("mp4");
        }
        return Some("mp4");
    }

    // HEIC/HEIF (also uses ftyp like MP4, but different brand)
    if bytes.len() >= 12
        && bytes[4] == 0x66
        && bytes[5] == 0x74
        && bytes[6] == 0x79
        && bytes[7] == 0x70
        && bytes.len() >= 16
    {
        let brand = &bytes[8..12];
        if brand == b"heic" || brand == b"heix" || brand == b"hevc" || brand == b"hevx" {
            return Some("heic");
        }
        if brand == b"mif1" || brand == b"msf1" {
            return Some("heif");
        }
    }

    // BMP (42 4D)
    if bytes.len() >= 2 && bytes[0] == 0x42 && bytes[1] == 0x4D {
        return Some("bmp");
    }

    // MP3 (ID3v2: 49 44 33 OR MPEG frame sync: FF FB/FF F3/FF F2)
    if bytes.len() >= 3 {
        if bytes[0] == 0x49 && bytes[1] == 0x44 && bytes[2] == 0x33 {
            return Some("mp3");
        }
        if bytes[0] == 0xFF && (bytes[1] == 0xFB || bytes[1] == 0xF3 || bytes[1] == 0xF2) {
            return Some("mp3");
        }
    }

    // WAV (52 49 46 46 ... 57 41 56 45)
    if bytes.len() >= 12
        && bytes[0] == 0x52
        && bytes[1] == 0x49
        && bytes[2] == 0x46
        && bytes[3] == 0x46
        && bytes[8] == 0x57
        && bytes[9] == 0x41
        && bytes[10] == 0x56
        && bytes[11] == 0x45
    {
        return Some("wav");
    }

    // OGG (4F 67 67 53)
    if bytes.len() >= 4
        && bytes[0] == 0x4F
        && bytes[1] == 0x67
        && bytes[2] == 0x67
        && bytes[3] == 0x53
    {
        return Some("ogg");
    }

    // FLAC (66 4C 61 43)
    if bytes.len() >= 4
        && bytes[0] == 0x66
        && bytes[1] == 0x4C
        && bytes[2] == 0x61
        && bytes[3] == 0x43
    {
        return Some("flac");
    }

    // ZIP/DOCX/XLSX/etc (50 4B 03 04 or 50 4B 05 06 or 50 4B 07 08)
    if bytes.len() >= 4 && bytes[0] == 0x50 && bytes[1] == 0x4B {
        if (bytes[2] == 0x03 && bytes[3] == 0x04)
            || (bytes[2] == 0x05 && bytes[3] == 0x06)
            || (bytes[2] == 0x07 && bytes[3] == 0x08)
        {
            // Try to detect Office Open XML documents
            // Need to check for specific files in the ZIP
            // For now, return zip (could be enhanced to detect docx/xlsx)
            return Some("zip");
        }
    }

    // Plain text files - detect common text patterns
    // Check if first 512 bytes are all printable ASCII or common UTF-8
    if bytes.len() >= 16 {
        let sample_len = bytes.len().min(512);
        let sample = &bytes[0..sample_len];
        let mut text_chars = 0;
        let mut total_chars = 0;

        for &byte in sample {
            total_chars += 1;
            // Printable ASCII or common whitespace
            if (byte >= 32 && byte <= 126) || byte == b'\n' || byte == b'\r' || byte == b'\t' {
                text_chars += 1;
            }
        }

        // If >90% are text characters, probably a text file
        if total_chars > 0 && (text_chars as f64 / total_chars as f64) > 0.9 {
            return Some("txt");
        }
    }

    None
}
