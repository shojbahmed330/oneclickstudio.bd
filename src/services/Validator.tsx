import { DependencyNode } from "../types";
import { LanguageService } from "./LanguageService";
import { ValidatorUtils } from "./validators/ValidatorUtils";
import { ReactValidator } from "./validators/ReactValidator";
import { ImportValidator } from "./validators/ImportValidator";
import { ProjectValidator } from "./validators/ProjectValidator";
import { ContentValidator } from "./validators/ContentValidator";

export class Validator {
  private utils = new ValidatorUtils();
  private reactValidator = new ReactValidator();
  private importValidator = new ImportValidator(this.utils);
  private projectValidator = new ProjectValidator(this.utils);
  private contentValidator = new ContentValidator();

  public async validateOutput(filesToValidate: Record<string, string>, allFiles: Record<string, string>, dependencyGraph: DependencyNode[], prompt: string = ""): Promise<string[]> {
    const errors: string[] = [];
    
    // Step 2: Update VFS with current project state
    const langService = LanguageService.getInstance();
    await langService.updateVFS(allFiles);

    errors.push(...this.projectValidator.validateFileSizeAndConflicts(filesToValidate));
    // Pass both the files to validate AND the full project context
    errors.push(...this.importValidator.validateImports(filesToValidate, allFiles));
    errors.push(...this.importValidator.validateDefaultImportCompatibility(filesToValidate, allFiles));
    
    // Step 1: Use LanguageService for deep TS validation (Syntax + Semantic)
    const tsFilesToValidate = Object.keys(filesToValidate).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    if (tsFilesToValidate.length > 0) {
      errors.push(...(await langService.validateFiles(tsFilesToValidate)));
    }

    errors.push(...this.importValidator.detectCircularDependencies(dependencyGraph));
    errors.push(...this.reactValidator.validateReactKeys(filesToValidate));
    errors.push(...this.contentValidator.validateForbiddenPatterns(filesToValidate));
    errors.push(...this.importValidator.validateZustandImports(filesToValidate));
    errors.push(...this.projectValidator.validateDependencies(filesToValidate, allFiles));
    errors.push(...this.importValidator.validatePathAliases(filesToValidate, allFiles));
    errors.push(...this.reactValidator.validateUseEffect(filesToValidate));
    errors.push(...this.reactValidator.validateRouterWrapping(filesToValidate, allFiles));
    errors.push(...this.contentValidator.validateMockDataEnforcement(filesToValidate, prompt));
    errors.push(...this.importValidator.validateExportConsistency(filesToValidate, allFiles));
    errors.push(...this.projectValidator.validateDirectoryStructure(filesToValidate));
    errors.push(...this.projectValidator.validateJSXExtension(filesToValidate));
    errors.push(...this.projectValidator.validateNoJSFiles(filesToValidate));
    errors.push(...this.contentValidator.validateTailwindCDN(filesToValidate));
    errors.push(...this.contentValidator.validateImageURLs(filesToValidate));
    errors.push(...this.reactValidator.validateContextProvider(filesToValidate, allFiles));
    return errors;
  }
}
