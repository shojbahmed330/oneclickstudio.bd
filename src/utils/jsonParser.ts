export function extractBalancedJsonBlock(input: string): string | null {
  const start = input.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i++) {
    const ch = input[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return input.slice(start, i + 1);
      }
    }
  }

  return null;
}

export function parseModelJson(rawText: string): any {
  const text = (rawText || '{}').trim();

  const tryParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      // Try repairing truncated/broken JSON
      const fixed = str
        .replace(/[\u0000-\u001F]/g, ' ')  // remove control characters
        .replace(/,\s*([}\]])/g, '$1');    // fix trailing commas
      try {
        return JSON.parse(fixed);
      } catch (e2) {
        return null;
      }
    }
  };

  // 1) Direct parse first
  let result = tryParse(text);
  if (result) return result;

  // 2) Parse fenced JSON block if present
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
  if (fenced) {
    result = tryParse(fenced);
    if (result) return result;
  }

  // 3) Parse first syntactically balanced JSON object from mixed text
  const balanced = extractBalancedJsonBlock(text);
  if (balanced) {
    result = tryParse(balanced);
    if (result) return result;
  }

  // 4) Legacy fallback: first { to last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const slice = text.substring(firstBrace, lastBrace + 1);
    result = tryParse(slice);
    if (result) return result;
  }

  // 5) Ultimate Fallback: Extract Markdown Code Blocks
  // If the model completely failed to output JSON, but output markdown code blocks.
  const files: Record<string, string> = {};
  let foundFiles = false;
  
  // Split by code blocks
  const parts = text.split(/```[a-zA-Z]*\n/);
  for (let i = 1; i < parts.length; i++) {
      const codePart = parts[i].split('```')[0];
      if (codePart) {
          // Try to find a filename in the text immediately preceding the code block
          const precedingText = parts[i-1].trim();
          const lines = precedingText.split('\n');
          const lastLine = lines[lines.length - 1].trim();
          
          // Look for something that looks like a file path
          const fileMatch = lastLine.match(/([a-zA-Z0-9_.\-/]+\.[a-zA-Z0-9]+)/);
          const filename = fileMatch ? fileMatch[1] : `extracted_file_${i}.ts`;
          
          files[filename] = codePart.trim();
          foundFiles = true;
      }
  }

  if (foundFiles) {
    return {
      thought: "JSON parsing failed due to truncation or syntax errors. Extracted files from markdown blocks as a fallback.",
      files: files
    };
  }

  // If all else fails, throw the original error to trigger retry
  return JSON.parse(text);
}
