
export interface ParsedError {
  code: string;
  message: string;
  missingEntity?: string;
  contextType?: string;
  suggestion?: string;
  file?: string;
  line?: number;
}

export class ErrorParser {
  /**
   * Parses a TypeScript error message to extract key information.
   * @param errorMessage The raw error message from the compiler.
   */
  public static parse(errorMessage: string): ParsedError {
    const result: ParsedError = {
      code: 'UNKNOWN',
      message: errorMessage,
    };

    // Extract file and line
    const fileLineMatch1 = errorMessage.match(/in (.*?) \(Line (\d+)/);
    const fileLineMatch2 = errorMessage.match(/in "(.*?)" at line (\d+)/);
    
    if (fileLineMatch1) {
      result.file = fileLineMatch1[1];
      result.line = parseInt(fileLineMatch1[2], 10);
    } else if (fileLineMatch2) {
      result.file = fileLineMatch2[1];
      result.line = parseInt(fileLineMatch2[2], 10);
    }

    // Extract TS Error Code (e.g., TS2304)
    const codeMatch = errorMessage.match(/TS(\d+)/);
    if (codeMatch) {
      result.code = `TS${codeMatch[1]}`;
    }

    // TS2304: Cannot find name 'X'
    if (result.code === 'TS2304' || errorMessage.includes("Cannot find name")) {
      const match = errorMessage.match(/Cannot find name ['"]([^'"]+)['"]/);
      if (match) {
        result.missingEntity = match[1];
      }
    }

    // TS2552: Cannot find name 'X'. Did you mean 'Y'?
    if (result.code === 'TS2552') {
      const match = errorMessage.match(/Cannot find name ['"]([^'"]+)['"]\. Did you mean ['"]([^'"]+)['"]/);
      if (match) {
        result.missingEntity = match[1];
        result.suggestion = match[2];
      }
    }

    // TS2339: Property 'X' does not exist on type 'Y'
    if (result.code === 'TS2339' || errorMessage.includes("does not exist on type")) {
      const match = errorMessage.match(/Property ['"]([^'"]+)['"] does not exist on type ['"]([^'"]+)['"]/);
      if (match) {
        result.missingEntity = match[1];
        result.contextType = match[2];
      }
    }

    // TS2307: Cannot find module 'X'
    if (result.code === 'TS2307' || errorMessage.includes("Cannot find module")) {
      const match = errorMessage.match(/Cannot find module ['"]([^'"]+)['"]/);
      if (match) {
        result.missingEntity = match[1];
      }
    }

    return result;
  }

  /**
   * Analyzes a list of errors and groups them by missing entities.
   */
  public static analyzeBatch(errors: string[]): ParsedError[] {
    return errors.map(err => this.parse(err));
  }
}
