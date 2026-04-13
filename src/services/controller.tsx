
import { GenerationMode, GenerationResult, WorkspaceType, ChatMessage } from "../types";
import { ModeDetector } from "./ModeDetector";
import { DiffEngine } from "./DiffEngine";
import { Validator } from "./Validator";
import { ContentValidator } from "./validators/ContentValidator";
import { ProjectValidator } from "./validators/ProjectValidator";
import { ValidatorUtils } from "./validators/ValidatorUtils";
import { Orchestrator } from "./Orchestrator";
import { GeminiService } from "./geminiService";
import { SelfHealingService } from "./selfHealingService";
import { addJsxAttribute, updateVariableValue } from "../utils/astModifier";
import { KnowledgeBaseService } from "./KnowledgeBaseService";

import { Logger } from "./Logger";
import { StateManager } from "./StateManager";
import { DependencyManager } from "./DependencyManager";
import { ErrorContextBuilder } from "./ErrorContextBuilder";

export class AIController {
  private modeDetector: typeof ModeDetector;
  private diffEngine: DiffEngine;
  private validator: Validator;
  private orchestrator: Orchestrator;
  private selfHealingService: SelfHealingService;
  private knowledgeBaseService: KnowledgeBaseService;
  
  private stateManager: StateManager;
  private dependencyManager: DependencyManager;
  private contentValidator = new ContentValidator();
  private projectValidator = new ProjectValidator(new ValidatorUtils());

  constructor(
    diffEngine?: DiffEngine,
    validator?: Validator,
    orchestrator?: Orchestrator,
    gemini?: GeminiService
  ) {
    this.modeDetector = ModeDetector;
    
    try {
      this.diffEngine = diffEngine || new DiffEngine();
      this.validator = validator || new Validator();
      const geminiService = gemini || new GeminiService();
      this.orchestrator = orchestrator || new Orchestrator(this.diffEngine, geminiService);
      this.selfHealingService = new SelfHealingService(this, this.validator);
      this.knowledgeBaseService = KnowledgeBaseService.getInstance();
      
      this.stateManager = new StateManager();
      this.dependencyManager = new DependencyManager(this.diffEngine, this.validator);
    } catch (error) {
      Logger.error("Initialization failed", error, { component: 'AIController' });
      throw new Error("Failed to initialize AI Controller dependencies.");
    }
  }

  private sortPlanByDependency(plan: any[]): any[] {
    const getPriority = (step: any): number => {
      const stepText = typeof step === 'object' && step !== null ? JSON.stringify(step).toLowerCase() : String(step).toLowerCase();
      
      if (stepText.includes('types.ts') || stepText.includes('.types.')) return 1;
      if (stepText.includes('utils/') || stepText.includes('helpers/') || stepText.includes('util') || stepText.includes('helper')) return 2;
      if (stepText.includes('services/') || stepText.includes('api/') || stepText.includes('service') || stepText.includes('api')) return 3;
      if (stepText.includes('components/') || stepText.includes('component')) return 4;
      if (stepText.includes('pages/') || stepText.includes('screens/') || stepText.includes('page') || stepText.includes('screen')) return 5;
      if (stepText.includes('app.tsx') || stepText.includes('main.tsx') || stepText.includes('routes.') || stepText.includes('router')) return 6;
      if (stepText.includes('schema.sql') || stepText.includes('database.sql')) return 7;

      return 10;
    };

    return [...plan].sort((a, b) => getPriority(a) - getPriority(b));
  }

  private getPhaseModel(phase: string, attempt: number = 0): string {
    const MODELS = {
      planning: 'deepseek/deepseek-chat-v3-0324',
      coding: 'deepseek/deepseek-chat-v3-0324',
      review: 'openai/gpt-4o-mini',
      security: 'openai/gpt-4o',
      performance: 'google/gemini-2.5-flash',
      uiux: 'openai/gpt-4o-mini',
      consistency: 'openai/gpt-4o',
      type_generation: 'openai/gpt-4o-mini',
      fixing_primary: 'openai/gpt-4o-mini',
      fixing_secondary: 'openai/gpt-4o',
      build: 'openai/gpt-4o-mini'
    };

    if (phase === 'fixing') {
      return attempt < 3 ? MODELS.fixing_primary : MODELS.fixing_secondary;
    }

    return (MODELS as any)[phase] || 'openai/gpt-4o-mini';
  }

  /**
   * Main entry point for the AI Brain
   */
  async *processRequest(
    prompt: string,
    currentFiles: Record<string, string>,
    history: ChatMessage[] = [],
    activeWorkspace?: WorkspaceType | boolean,
    modelName: string = 'gemini-3-pro-preview',
    projectConfig?: any
  ): AsyncIterable<any> {
    const correlationId = crypto.randomUUID();
    const logContext = { component: 'AIController', correlationId, modelName };
    
    const fileChanged = this.diffEngine.detectFileChanges(currentFiles, this.stateManager.fileHashes);
    if (fileChanged) {
      Logger.info("Manual file changes detected → invalidating cache", logContext);
      this.stateManager.clearCache();
    }

    // 1. Mode Detection
    const mode = this.modeDetector.detectMode(prompt, currentFiles);
    Logger.info(`Mode Detected: ${mode.toUpperCase()}`, { ...logContext, mode });
    yield { type: 'status', phase: 'PLANNING', message: `Mode Detected: ${mode.toUpperCase()}` };

    const originalPromptHash = this.diffEngine.hashContent(prompt);

    // Smart Skip Logic (Early Exit)
    if (
      originalPromptHash === this.stateManager.lastPromptHash &&
      mode === this.stateManager.lastMode &&
      mode !== GenerationMode.FIX &&
      this.stateManager.lastResult
    ) {
      Logger.info("No changes detected. Returning cached result.", logContext);
      yield { type: 'status', phase: 'PREVIEW_READY', message: "No changes detected. Using cache." };
      yield { type: 'result', ...this.stateManager.lastResult };
      return;
    }

    // 2. Dependency Mapping (Memory Graph)
    yield { type: 'status', phase: 'PLANNING', message: "Mapping dependencies..." };
    this.dependencyManager.updateDependencyGraph(currentFiles);

    // 3. Orchestration Loop
    let attempts = 0;
    const maxAttempts = 20; // Effectively unlimited retries until accurate code is generated
    let finalResult: GenerationResult | null = null;
    let failedPatchFiles = new Set<string>();

    // 3.1 Pre-emptive Detection: If files are already broken, force full rewrite
    yield { type: 'status', phase: 'PLANNING', message: "Checking for broken files..." };
    const initialErrors = this.contentValidator.validateTypeScriptSyntax(currentFiles);
    for (const err of initialErrors) {
      const match = err.match(/TS Syntax Error in ([^:]+):/);
      if (match && match[1]) {
        const brokenFile = match[1].trim();
        Logger.warn(`Pre-emptively forcing rewrite for broken file: ${brokenFile}`, logContext);
        failedPatchFiles.add(brokenFile);
      }
    }

    let errorContext = "";
    let activeMode = mode;
    let allGeneratedFiles: Record<string, string> = {};
    let finalPlan: string[] = [];
    let finalAnswer: string = "Task completed successfully.";
    let thoughts: string[] = [];

    while (attempts < maxAttempts) {
      if (attempts > 0) {
        activeMode = GenerationMode.FIX;
      }
      
      try {
        let generatedFilesThisAttempt: Record<string, string> = {};
        let currentContextFiles = { ...currentFiles, ...allGeneratedFiles }; // Files including current project state + generated files
        let accumulatedApplyErrors: string[] = [];

        let currentPrompt = prompt + errorContext;
        if (failedPatchFiles.size > 0) {
          currentPrompt += `\n\n🚨 CRITICAL RECOVERY MODE:\nYou previously failed to generate valid patches for these files:\n${Array.from(failedPatchFiles).map(f => `- ${f}`).join('\n')}\n\nFor these specific files ONLY, DO NOT USE PATCHES. You MUST return the FULL, complete file content.`;
        }

        // Helper to apply files to a context and return normalized files
        const applyToContext = (targetContext: Record<string, string>, phaseFiles: Record<string, string> | any[], astEdits?: any[]) => {
          let normalizedPhaseFiles: Record<string, string> = {};
          if (Array.isArray(phaseFiles)) {
            for (const item of phaseFiles) {
              if (item && typeof item === 'object') {
                const path = item.path || item.file || item.filename;
                const content = item.content || item.code || item.body || '';
                if (path && typeof path === 'string') {
                  normalizedPhaseFiles[path] = typeof content === 'string' ? content : JSON.stringify(content);
                }
              }
            }
          } else if (phaseFiles && typeof phaseFiles === 'object') {
            normalizedPhaseFiles = phaseFiles as Record<string, string>;
          }

          // Apply AST Edits
          if (astEdits && Array.isArray(astEdits)) {
            for (const edit of astEdits) {
              const file = edit.file;
              if (file && targetContext[file]) {
                try {
                  let updatedCode = targetContext[file];
                  if (edit.action === 'add_jsx_attribute') {
                    updatedCode = addJsxAttribute(updatedCode, edit.component, edit.attribute, edit.value, edit.isExpression);
                  } else if (edit.action === 'update_variable') {
                    updatedCode = updateVariableValue(updatedCode, edit.variable, edit.value, edit.isString);
                  }
                  normalizedPhaseFiles[file] = updatedCode;
                } catch (e) {
                  accumulatedApplyErrors.push(`Failed to apply AST edit to ${file}: ${e}`);
                }
              }
            }
          }

          const { merged, errors } = this.diffEngine.applyChanges(targetContext, normalizedPhaseFiles, failedPatchFiles);
          accumulatedApplyErrors.push(...errors);

          for (const err of errors) {
            const patchMatch = err.match(/Failed to apply patch for ([^\s:]+)/);
            const fullFileMatch = err.match(/File ([^\s:]+) was returned as a full file/);
            const target = (patchMatch && patchMatch[1]) || (fullFileMatch && fullFileMatch[1]);
            if (target) {
              const cleanedTarget = target.replace(/[,.]$/, '').trim();
              failedPatchFiles.add(cleanedTarget);
            }
          }

          return { merged, normalizedPhaseFiles };
        };

        const isPatchMode = false; // Disabled: Always use full files for reliability
        let patchInstruction = "\nFULL FILE MODE:\nAlways return the COMPLETE file content for any file you create or modify.\nDO NOT use patches, diffs, or partial snippets.\nDO NOT start the file with '--- filename' or any diff headers. Just return the raw code.\n";

        const strictEditBoundaryInstruction = activeMode === GenerationMode.SCAFFOLD
          ? ""
          : "\n\n🎯 STRICT CHANGE BOUNDARY:\nImplement ONLY what the user explicitly requested.\nDo not add extra improvements, refactors, style tweaks, or unrelated fixes.";

        const phases = this.orchestrator.decidePhases(activeMode, []);
        Logger.info(`Running phases: ${phases.join(', ')}`, logContext);

        // Phase 1: Planning
        if (phases.includes("planning")) {
          const planningModel = this.getPhaseModel('planning');
          Logger.info(`Executing PLANNING phase with model: ${planningModel}`, { ...logContext, modelName: planningModel });
          yield { type: 'status', phase: 'PLANNING', message: `Planning architecture... (${planningModel})` };
          const planningPrompt = currentPrompt + strictEditBoundaryInstruction;
          const input = this.orchestrator.buildPhaseInput('planning', planningPrompt, currentContextFiles, this.dependencyManager.getGraph(), activeWorkspace, projectConfig);
          const plan = await this.orchestrator.executePhaseWithCache('planning', input, planningModel, this.stateManager.phaseCache, activeMode === GenerationMode.FIX, projectConfig);
          thoughts.push(`[PLAN]: ${plan.thought || 'Planned architecture.'}`);
          finalPlan = plan.plan || [];
          finalPlan = this.sortPlanByDependency(finalPlan);
          
          yield { type: 'plan', plan: finalPlan, thought: plan.thought };

          // Pre-apply dependency audit on the plan itself (Pass A validation)
          const planValidationErrors = this.projectValidator.validatePlan(finalPlan, currentContextFiles);
          if (planValidationErrors.length > 0) {
            Logger.warn(`Plan validation failed. Attempting to fix plan...`, { errors: planValidationErrors });
            errorContext += `\n\n🚨 PLAN VALIDATION ERROR:\nYour previous plan was rejected for the following reasons:\n${planValidationErrors.map(e => `- ${e}`).join('\n')}\n\nPlease generate a NEW, corrected plan that follows the dependency order and correctly identifies which files need to be CREATED vs UPDATED.`;
            attempts++;
            continue; // Retry planning
          }
        }

        // Phase 2: Coding (Developer)
        if (phases.includes("coding")) {
          yield { type: 'status', phase: 'CODING', message: "Generating code..." };
          
          if ((activeMode === GenerationMode.SCAFFOLD || activeMode === GenerationMode.EDIT) && finalPlan && finalPlan.length > 0) {
            let completedIndices: number[] = [];
            let scaffoldAborted = false;
            
            for (let i = 0; i < finalPlan.length; i++) {
              // Save checkpoint before each main step
              this.stateManager.saveCheckpoint(allGeneratedFiles);
              const mainStepCheckpoint = { ...allGeneratedFiles };
              const mainContextCheckpoint = { ...currentContextFiles };

              const step = finalPlan[i];
              yield { type: 'plan_progress', activePlanIndex: i, completedPlanIndices: completedIndices };
              const stepTitle = typeof step === 'object' && step !== null ? ((step as any).title || (step as any).step || 'Step ' + (i+1)) : step;
              
              const subPlans = typeof step === 'object' && step !== null && Array.isArray((step as any).subPlans) ? (step as any).subPlans : [];
              
              let stepFiles: Record<string, string> = {};

              if (subPlans.length > 0) {
                for (let j = 0; j < subPlans.length; j++) {
                  const subCheckpoint = { ...allGeneratedFiles };
                  const subContextCheckpoint = { ...currentContextFiles };

                  const subPlan = subPlans[j];
                  const subPlanTitle = typeof subPlan === 'string' ? subPlan : JSON.stringify(subPlan);
                  
                  const displayTitle = subPlanTitle.length > 60 ? subPlanTitle.substring(0, 60) + '...' : subPlanTitle;
                  yield { type: 'status', phase: 'CODING', message: `Implementing: ${stepTitle} ➔ ${displayTitle}` };
                  
                  const stepInput = `CURRENT MAIN PLAN: ${stepTitle}\nCURRENT SUB-PLAN TO IMPLEMENT:\n${subPlanTitle}\n\nOVERALL PLAN:\n${JSON.stringify(finalPlan)}\n\nCONTEXT:\n${this.orchestrator.buildContext(currentContextFiles, this.dependencyManager.getGraph(), currentPrompt, projectConfig)}\n\nINSTRUCTION: Implement ONLY the CURRENT SUB-PLAN. Output the files modified or created. Focus ONLY on this specific sub-plan to ensure detailed and complete code. Do NOT implement other sub-plans yet.`;
                  
                  const code = await this.orchestrator.executePhaseWithCache('coding', stepInput, this.getPhaseModel('coding'), this.stateManager.phaseCache, false, projectConfig);
                  
                  let subPlanFiles: Record<string, string> = {};
                  if (code.files) {
                    subPlanFiles = code.files;
                  }
                  if (code.answer) {
                    finalAnswer = code.answer;
                  }

                  // Transactional Staging & Validation
                  let { merged, normalizedPhaseFiles } = applyToContext({ ...currentContextFiles }, subPlanFiles, code.ast_edits || []);
                  let subPlanErrors = await this.validator.validateOutput(normalizedPhaseFiles, merged, this.dependencyManager.getGraph(), currentPrompt);
                  subPlanErrors.push(...accumulatedApplyErrors);
                  accumulatedApplyErrors = [];

                  let subFixAttempts = 0;
                  const maxSubFixAttempts = 6; // Increased from 3 to 6
                  while (subPlanErrors.length > 0 && subFixAttempts < maxSubFixAttempts) {
                    yield { type: 'status', phase: 'FIXING', message: `Fixing errors in sub-plan: ${displayTitle}... (Attempt ${subFixAttempts + 1}/${maxSubFixAttempts})` };
                    
                    const healingResult = this.selfHealingService.attemptHeal(subPlanFiles, subPlanErrors);
                    subPlanFiles = healingResult.healedFiles;
                    subPlanErrors = healingResult.remainingErrors;

                    if (healingResult.detectedMissingTypes.length > 0) {
                      const typeHealResult = await this.selfHealingService.runTypeHealingLoop(subPlanFiles, subPlanErrors, this.getPhaseModel('type_generation'), projectConfig);
                      subPlanFiles = typeHealResult.healedFiles;
                      subPlanErrors = typeHealResult.remainingErrors;
                    }

                    const fixApply = applyToContext({ ...currentContextFiles }, subPlanFiles, []);
                    merged = fixApply.merged;
                    normalizedPhaseFiles = fixApply.normalizedPhaseFiles;
                    
                    if (subPlanErrors.length > 0) {
                      const fixInput = `USER REQUEST (FIX ERROR in ${displayTitle}):\n${ErrorContextBuilder.build(subPlanErrors, subFixAttempts, subPlanFiles)}\n\nCONTEXT:\n${this.orchestrator.buildContext(currentContextFiles, this.dependencyManager.getGraph(), currentPrompt, projectConfig)}\n\nINSTRUCTION: Previous attempt failed. Analyze the errors carefully and provide a NEW fix. Do not repeat the same mistake.`;
                      const fixCode = await this.orchestrator.executePhaseWithCache('coding', fixInput, this.getPhaseModel('fixing', subFixAttempts), this.stateManager.phaseCache, true, projectConfig);
                      if (fixCode.files) {
                        subPlanFiles = { ...subPlanFiles, ...fixCode.files };
                        const finalFixApply = applyToContext({ ...currentContextFiles }, subPlanFiles, fixCode.ast_edits || []);
                        merged = finalFixApply.merged;
                        normalizedPhaseFiles = finalFixApply.normalizedPhaseFiles;
                      }
                      subPlanErrors = await this.validator.validateOutput(subPlanFiles, merged, this.dependencyManager.getGraph(), currentPrompt);
                      subPlanErrors.push(...accumulatedApplyErrors);
                      accumulatedApplyErrors = [];
                    }
                    subFixAttempts++;
                  }

                  if (subPlanErrors.length > 0) {
                    yield { type: 'status', phase: 'FIXING', message: `Failed to fix sub-plan errors after ${maxSubFixAttempts} attempts. Rolling back sub-plan to prevent crash.` };
                    allGeneratedFiles = subCheckpoint;
                    currentContextFiles = subContextCheckpoint;
                    scaffoldAborted = true;
                    break;
                  }

                  // Commit sub-plan
                  allGeneratedFiles = { ...allGeneratedFiles, ...subPlanFiles };
                  generatedFilesThisAttempt = { ...generatedFilesThisAttempt, ...subPlanFiles };
                  currentContextFiles = merged;
                  stepFiles = { ...stepFiles, ...subPlanFiles };
                  this.dependencyManager.updateDependencyGraph(currentContextFiles);
                }
                if (scaffoldAborted) {
                  const lastGoodState = this.stateManager.rollback();
                  if (lastGoodState) {
                    allGeneratedFiles = lastGoodState;
                    currentContextFiles = mainContextCheckpoint;
                  }
                  break;
                }
              } else {
                const codingModel = this.getPhaseModel('coding');
                Logger.info(`Executing CODING phase for step: ${stepTitle} with model: ${codingModel}`, { ...logContext, modelName: codingModel });
                yield { type: 'status', phase: 'CODING', message: `Implementing: ${stepTitle} (${codingModel})` };
                
                const stepInput = `CURRENT MAIN PLAN TO IMPLEMENT:\n${JSON.stringify(step)}\n\nOVERALL PLAN:\n${JSON.stringify(finalPlan)}\n\nCONTEXT:\n${this.orchestrator.buildContext(currentContextFiles, this.dependencyManager.getGraph(), currentPrompt, projectConfig)}\n\nINSTRUCTION: Read the 'subPlans' of the CURRENT MAIN PLAN and implement all of them. Output the files modified or created. Do NOT implement steps from other main plans yet. Focus ONLY on the current main plan's sub-plans.`;
                
                const code = await this.orchestrator.executePhaseWithCache('coding', stepInput, codingModel, this.stateManager.phaseCache, false, projectConfig);
                
                if (code.files) {
                  stepFiles = { ...stepFiles, ...code.files };
                }
                if (code.answer) {
                  finalAnswer = code.answer;
                }

                // Transactional Staging & Validation
                let { merged, normalizedPhaseFiles } = applyToContext({ ...currentContextFiles }, stepFiles, code.ast_edits || []);
                let stepErrors = await this.validator.validateOutput(normalizedPhaseFiles, merged, this.dependencyManager.getGraph(), currentPrompt);
                stepErrors.push(...accumulatedApplyErrors);
                accumulatedApplyErrors = [];

                let fixAttempts = 0;
                const maxStepFixAttempts = 5;
                while (stepErrors.length > 0 && fixAttempts < maxStepFixAttempts) {
                  yield { type: 'status', phase: 'FIXING', message: `Fixing errors in ${stepTitle}... (${stepErrors.length} issues, attempt ${fixAttempts + 1}/${maxStepFixAttempts})` };
                  
                  const healingResult = this.selfHealingService.attemptHeal(stepFiles, stepErrors);
                  stepFiles = healingResult.healedFiles;
                  stepErrors = healingResult.remainingErrors;

                  if (healingResult.detectedMissingTypes.length > 0) {
                    const typeHealResult = await this.selfHealingService.runTypeHealingLoop(stepFiles, stepErrors, this.getPhaseModel('type_generation'), projectConfig);
                    stepFiles = typeHealResult.healedFiles;
                    stepErrors = typeHealResult.remainingErrors;
                  }

                  const fixApply = applyToContext({ ...currentContextFiles }, stepFiles, []);
                  merged = fixApply.merged;
                  normalizedPhaseFiles = fixApply.normalizedPhaseFiles;

                  if (stepErrors.length > 0) {
                    const fixInput = `USER REQUEST (FIX ERROR in ${stepTitle}):\n${ErrorContextBuilder.build(stepErrors, fixAttempts, stepFiles)}\n\nCONTEXT:\n${this.orchestrator.buildContext(currentContextFiles, this.dependencyManager.getGraph(), currentPrompt, projectConfig)}`;
                    const fixCode = await this.orchestrator.executePhaseWithCache('coding', fixInput, this.getPhaseModel('fixing', fixAttempts), this.stateManager.phaseCache, true, projectConfig);
                    
                    if (fixCode.files) {
                      stepFiles = { ...stepFiles, ...fixCode.files };
                      const finalFixApply = applyToContext({ ...currentContextFiles }, stepFiles, fixCode.ast_edits || []);
                      merged = finalFixApply.merged;
                      normalizedPhaseFiles = finalFixApply.normalizedPhaseFiles;
                    }
                    
                    stepErrors = await this.validator.validateOutput(normalizedPhaseFiles, merged, this.dependencyManager.getGraph(), currentPrompt);
                    stepErrors.push(...accumulatedApplyErrors);
                    accumulatedApplyErrors = [];
                  }
                  fixAttempts++;
                }

                if (stepErrors.length > 0) {
                  yield { type: 'status', phase: 'FIXING', message: `Failed to fix errors in ${stepTitle}. Rolling back.` };
                  allGeneratedFiles = mainStepCheckpoint;
                  currentContextFiles = mainContextCheckpoint;
                  scaffoldAborted = true;
                  break;
                }

                // Commit main step
                allGeneratedFiles = { ...allGeneratedFiles, ...stepFiles };
                generatedFilesThisAttempt = { ...generatedFilesThisAttempt, ...stepFiles };
                currentContextFiles = merged;
                this.dependencyManager.updateDependencyGraph(currentContextFiles);
              }

              completedIndices.push(i);
            }
            
            if (scaffoldAborted) {
              break;
            }

            yield { type: 'plan_progress', activePlanIndex: -1, completedPlanIndices: completedIndices };
            thoughts.push(`[CODE]: Implemented all plan steps with transactional validation and rollback support.`);
          } else {
            const codingModel = this.getPhaseModel('coding');
            Logger.info(`Executing CODING phase (direct) with model: ${codingModel}`, { ...logContext, modelName: codingModel });
            yield { type: 'status', phase: 'CODING', message: `Generating code... (${codingModel})` };
            
            const codingPrompt = currentPrompt + strictEditBoundaryInstruction;
            const input = (finalPlan && finalPlan.length > 0)
              ? `PLAN:\n${JSON.stringify(finalPlan)}\n\nCONTEXT:\n${this.orchestrator.buildContext(currentContextFiles, this.dependencyManager.getGraph(), currentPrompt, projectConfig)}`
              : `USER REQUEST:\n${codingPrompt}${patchInstruction}\n\nCONTEXT:\n${this.orchestrator.buildContext(currentContextFiles, this.dependencyManager.getGraph(), currentPrompt, projectConfig)}`;
            const code = await this.orchestrator.executePhaseWithCache('coding', input, codingModel, this.stateManager.phaseCache, activeMode === GenerationMode.FIX, projectConfig);
            thoughts.push(`[CODE]: ${code.thought || 'Implemented code.'}`);
            if (code.answer) finalAnswer = code.answer;
            const { merged } = applyToContext(currentContextFiles, code.files || {}, code.ast_edits);
            currentContextFiles = merged;
            allGeneratedFiles = { ...allGeneratedFiles, ...(code.files || {}) };
            generatedFilesThisAttempt = { ...generatedFilesThisAttempt, ...(code.files || {}) };
          }
        }

        // Phase 3: Review
        if (phases.includes("review")) {
          const reviewModel = this.getPhaseModel('review');
          Logger.info(`Executing REVIEW phase with model: ${reviewModel}`, { ...logContext, modelName: reviewModel });
          yield { type: 'status', phase: 'REVIEW', message: `Reviewing implementation... (${reviewModel})` };
          const reviewPrompt = currentPrompt + strictEditBoundaryInstruction;
          
          // CRITICAL: Always include the files generated in this attempt for review
          const input = `GENERATED FILES IN THIS ATTEMPT:\n${JSON.stringify(generatedFilesThisAttempt, null, 2)}\n\n${patchInstruction}\n\nUSER REQUEST:\n${reviewPrompt}\n\nCONTEXT:\n${this.orchestrator.buildContext(currentContextFiles, this.dependencyManager.getGraph(), currentPrompt, projectConfig)}`;
          
          const review = await this.orchestrator.executePhaseWithCache('review', input, reviewModel, this.stateManager.phaseCache, activeMode === GenerationMode.FIX, projectConfig);
          thoughts.push(`[REVIEW]: ${review.thought || 'Reviewed code.'}`);
          if (activeMode === GenerationMode.FIX && review.answer) finalAnswer = review.answer;
          const reviewResult = applyToContext(currentContextFiles, review.files || {}, review.ast_edits);
          currentContextFiles = reviewResult.merged;
          allGeneratedFiles = { ...allGeneratedFiles, ...reviewResult.normalizedPhaseFiles };
          generatedFilesThisAttempt = { ...generatedFilesThisAttempt, ...reviewResult.normalizedPhaseFiles };
        }

        // Phase 4: Security
        if (phases.includes("security")) {
          const securityModel = this.getPhaseModel('security');
          Logger.info(`Executing SECURITY phase with model: ${securityModel}`, { ...logContext, modelName: securityModel });
          yield { type: 'status', phase: 'SECURITY', message: `Security audit... (${securityModel})` };
          const input = `FILES TO AUDIT:\n${JSON.stringify(generatedFilesThisAttempt, null, 2)}\n\n${patchInstruction}\n\nUSER REQUEST:\n${currentPrompt}\n\nCONTEXT:\n${this.orchestrator.buildContext(currentContextFiles, this.dependencyManager.getGraph(), currentPrompt, projectConfig)}`;
          const security = await this.orchestrator.executePhaseWithCache('security', input, securityModel, this.stateManager.phaseCache, activeMode === GenerationMode.FIX, projectConfig);
          thoughts.push(`[SECURITY]: ${security.thought || 'Security audit complete.'}`);
          if (activeMode === GenerationMode.OPTIMIZE && security.answer) finalAnswer = security.answer;
          const securityResult = applyToContext(currentContextFiles, security.files || {}, security.ast_edits);
          currentContextFiles = securityResult.merged;
          allGeneratedFiles = { ...allGeneratedFiles, ...securityResult.normalizedPhaseFiles };
          generatedFilesThisAttempt = { ...generatedFilesThisAttempt, ...securityResult.normalizedPhaseFiles };
        }

        // Phase 5: Performance
        if (phases.includes("performance")) {
          const perfModel = this.getPhaseModel('performance');
          Logger.info(`Executing PERFORMANCE phase with model: ${perfModel}`, { ...logContext, modelName: perfModel });
          yield { type: 'status', phase: 'PERFORMANCE', message: `Performance audit... (${perfModel})` };
          const input = `FILES TO AUDIT:\n${JSON.stringify(generatedFilesThisAttempt, null, 2)}\n\n${patchInstruction}\n\nUSER REQUEST:\n${currentPrompt}\n\nCONTEXT:\n${this.orchestrator.buildContext(currentContextFiles, this.dependencyManager.getGraph(), currentPrompt, projectConfig)}`;
          const perf = await this.orchestrator.executePhaseWithCache('performance', input, perfModel, this.stateManager.phaseCache, activeMode === GenerationMode.FIX, projectConfig);
          thoughts.push(`[PERF]: ${perf.thought || 'Performance audit complete.'}`);
          const perfResult = applyToContext(currentContextFiles, perf.files || {}, perf.ast_edits);
          currentContextFiles = perfResult.merged;
          allGeneratedFiles = { ...allGeneratedFiles, ...perfResult.normalizedPhaseFiles };
          generatedFilesThisAttempt = { ...generatedFilesThisAttempt, ...perfResult.normalizedPhaseFiles };
        }

        // Phase 6: UI/UX
        if (phases.includes("uiux")) {
          const uiuxModel = this.getPhaseModel('uiux');
          Logger.info(`Executing UIUX phase with model: ${uiuxModel}`, { ...logContext, modelName: uiuxModel });
          yield { type: 'status', phase: 'UIUX', message: `UI/UX polish... (${uiuxModel})` };
          const input = `FILES TO POLISH:\n${JSON.stringify(generatedFilesThisAttempt, null, 2)}\n\n${patchInstruction}\n\nUSER REQUEST:\n${currentPrompt}\n\nCONTEXT:\n${this.orchestrator.buildContext(currentContextFiles, this.dependencyManager.getGraph(), currentPrompt, projectConfig)}`;
          const uiux = await this.orchestrator.executePhaseWithCache('uiux', input, uiuxModel, this.stateManager.phaseCache, activeMode === GenerationMode.FIX, projectConfig);
          thoughts.push(`[UIUX]: ${uiux.thought || 'UI/UX polish complete.'}`);
          if (activeMode === GenerationMode.OPTIMIZE && uiux.answer) finalAnswer = uiux.answer;
          const uiuxResult = applyToContext(currentContextFiles, uiux.files || {}, uiux.ast_edits);
          currentContextFiles = uiuxResult.merged;
          allGeneratedFiles = { ...allGeneratedFiles, ...uiuxResult.normalizedPhaseFiles };
          generatedFilesThisAttempt = { ...generatedFilesThisAttempt, ...uiuxResult.normalizedPhaseFiles };
        }

        // 3.5 Patch Enforcement Check
        const patchViolations = this.diffEngine.enforcePatchRules(generatedFilesThisAttempt, currentFiles, failedPatchFiles);
        if (patchViolations.length > 0) {
          yield { type: 'status', phase: 'FIXING', message: "Fixing patch violations..." };
          Logger.warn(`Patch violation detected`, { ...logContext, violations: patchViolations });
          for (const v of patchViolations) {
            failedPatchFiles.add(v);
          }
          const violationMsg = `Patch violation detected for:\n${patchViolations.join('\n')}\n\nThese files already exist. You MUST return unified diff patches for them. Do NOT return the full file.`;
          errorContext = `\n\nIMPORTANT: ${violationMsg}`;
          attempts++;
          continue;
        }

        // 4. Transactional Apply & Pre-apply Dependency Audit
        // All-or-nothing: If any critical validation fails, the entire set of generated files for this attempt is rejected.
        // This prevents partial merges and ensures structural consistency.
        yield { type: 'status', phase: 'VERIFICATION', message: "Running shadow build..." };
        
        let filesToValidateBeforeApply = allGeneratedFiles;
        let preApplyValidationErrors = await this.validator.validateOutput(filesToValidateBeforeApply, currentContextFiles, this.dependencyManager.getGraph(), currentPrompt);
        preApplyValidationErrors.push(...accumulatedApplyErrors);

        if (preApplyValidationErrors.length > 0) {
          yield { type: 'status', phase: 'FIXING', message: `Running background auto-heal...` };
          const healingResult = this.selfHealingService.attemptHeal(filesToValidateBeforeApply, preApplyValidationErrors);
          
          let healedFiles = healingResult.healedFiles;
          let remainingErrors = healingResult.remainingErrors;

          if (healingResult.detectedMissingTypes.length > 0) {
            yield { type: 'status', phase: 'FIXING', message: `Auto-generating missing types...` };
            const typeHealResult = await this.selfHealingService.runTypeHealingLoop(healedFiles, remainingErrors, this.getPhaseModel('type_generation'), projectConfig);
            healedFiles = typeHealResult.healedFiles;
            remainingErrors = typeHealResult.remainingErrors;
          }

          if (remainingErrors.length < preApplyValidationErrors.length || healedFiles !== filesToValidateBeforeApply) {
             // Healing was partially or fully successful
             filesToValidateBeforeApply = healedFiles;
             allGeneratedFiles = healedFiles; // Update the main reference
             preApplyValidationErrors = remainingErrors;
             
             // Re-apply the healed files to currentContextFiles
             const { merged } = this.diffEngine.applyChanges(currentFiles, allGeneratedFiles, failedPatchFiles);
             currentContextFiles = merged;
             this.dependencyManager.updateDependencyGraph(currentContextFiles);
          }
        }

        if (preApplyValidationErrors.length > 0) {
          yield { type: 'status', phase: 'FIXING', message: `Auto-healing code... (${preApplyValidationErrors.length} issues)` };
          
          // Only show errors to the user on the final attempt
          if (attempts === maxAttempts - 1) {
            yield { type: 'validation_errors', errors: preApplyValidationErrors };
          }
          
          Logger.warn(`Pre-apply validation failed (Attempt ${attempts + 1})`, { ...logContext, preApplyValidationErrors });

          // Fail-class aware retry for pre-apply errors
          errorContext = ErrorContextBuilder.build(preApplyValidationErrors, attempts, generatedFilesThisAttempt);
          attempts++;
          continue; // Retry with new error context
        }

        yield { type: 'status', phase: 'VERIFICATION', message: "Verification successful!" };

        // If pre-apply validation passes, then the changes are considered valid for merging.
        // The `currentContextFiles` already holds the merged state after transactional application calls.
        const mergedFiles = currentContextFiles;
        this.dependencyManager.updateDependencyGraph(mergedFiles); // Final update after successful merge

        // 5. Runtime Validation (Post-apply sanity check - mostly for final structural consistency)
        yield { type: 'status', phase: 'REVIEW', message: "Validating final code structure..." };
        const postApplyValidationErrors = await this.validator.validateOutput(mergedFiles, mergedFiles, this.dependencyManager.getGraph(), currentPrompt);

        if (postApplyValidationErrors.length > 0) {
          yield { type: 'status', phase: 'FIXING', message: `Finalizing auto-heal... (${postApplyValidationErrors.length} issues)` };
          
          // Only show errors to the user on the final attempt
          if (attempts === maxAttempts - 1) {
            yield { type: 'validation_errors', errors: postApplyValidationErrors };
          }
          
          Logger.warn(`Post-apply validation failed (Attempt ${attempts + 1})`, { ...logContext, postApplyValidationErrors });

          errorContext = ErrorContextBuilder.build(postApplyValidationErrors, attempts, generatedFilesThisAttempt);
          attempts++;
          continue; // Retry with new error context
        }

        // Step 8: Automatic Fixing & Preview Release
        yield { type: 'status', phase: 'REVIEW', message: "✅ Diagnostics Clean (Zero Errors). Preparing Preview Release..." };

        // 6. Project Consistency Fixer (Final Polish)
        const consistencyModel = this.getPhaseModel('consistency');
        Logger.info(`Executing CONSISTENCY phase with model: ${consistencyModel}`, { ...logContext, modelName: consistencyModel });
        yield { type: 'status', phase: 'FIXING', message: `🧠 Running Project Consistency Fixer... (${consistencyModel})` };
        const consistencyInput = `USER REQUEST: ${currentPrompt}\n\nCURRENT PROJECT STATE:\n${this.orchestrator.buildContext(mergedFiles, this.dependencyManager.getGraph(), currentPrompt, projectConfig)}\n\nINSTRUCTION: Perform a final consistency check. Fix missing files, broken imports, router wrapping, and type definitions.`;
        
        const consistencyResult = await this.orchestrator.executePhaseWithCache('consistency', consistencyInput, consistencyModel, this.stateManager.phaseCache, true, projectConfig);
        
        if (consistencyResult.files && Object.keys(consistencyResult.files).length > 0) {
          yield { type: 'status', phase: 'FIXING', message: `Consistency Fixer applied ${Object.keys(consistencyResult.files).length} fixes.` };
          allGeneratedFiles = { ...allGeneratedFiles, ...consistencyResult.files };
          const finalApply = applyToContext({ ...mergedFiles }, consistencyResult.files, []);
          currentContextFiles = finalApply.merged;
          this.dependencyManager.updateDependencyGraph(currentContextFiles);
        }

        // 7. Success: Finalize Result
        yield { type: 'status', phase: 'BUILDING', message: "Building application..." };
        yield { type: 'status', phase: 'PREVIEW_READY', message: "Finalizing build..." };

        // Learning Loop: If we had errors and fixed them, learn from it
        if (attempts > 0) {
          this.selfHealingService.learnFromFix(
            errorContext.split('\n').filter(l => l.startsWith('- এরর:')).map(l => l.replace('- এরর: ', '')),
            allGeneratedFiles,
            currentFiles,
            this.knowledgeBaseService.getFullKnowledgeBase(),
            modelName,
            projectConfig
          ).catch(e => Logger.error("Learning loop failed", e));
        }

        finalResult = {
          files: allGeneratedFiles, // Return ALL files generated across all attempts
          answer: finalAnswer,
          thought: thoughts.join('\n\n'),
          plan: finalPlan,
          mode
        };

        this.stateManager.lastPromptHash = originalPromptHash;
        this.stateManager.lastMode = mode;
        this.stateManager.lastResult = finalResult;
        this.diffEngine.updateSnapshot(mergedFiles, this.stateManager.fileHashes);

        yield { type: 'result', ...finalResult };
        return;

      } catch (error: any) {
        Logger.error(`Generation error`, error, logContext);
        attempts++;
        if (attempts >= maxAttempts) {
          Logger.warn(`Max attempts reached. Yielding partial/invalid files.`, logContext);
          break; // Break out of the loop to yield what we have
        }
        yield { type: 'status', phase: 'FIXING', message: `Auto-healing unexpected issue...` };
      }
    }

    yield { type: 'status', phase: 'PREVIEW_READY', message: attempts >= maxAttempts ? "Max attempts reached. Some files may have errors." : "Finalizing build..." };
    yield { 
      type: 'result', 
      files: allGeneratedFiles, 
      answer: finalAnswer + (attempts >= maxAttempts ? "\n\n⚠️ Note: The AI reached the maximum number of attempts to fix errors. Some files might still contain errors. Please review the code manually." : ""),
      thought: thoughts.join('\n\n'),
      plan: finalPlan,
      mode 
    };
  }

  async *processRequestStream(
    prompt: string,
    currentFiles: Record<string, string>,
    history: ChatMessage[] = [],
    activeWorkspace?: WorkspaceType | boolean,
    modelName: string = 'gemini-3-pro-preview',
    projectConfig?: any
  ): AsyncIterable<string> {
    try {
      const generator = this.processRequest(prompt, currentFiles, history, activeWorkspace, modelName, projectConfig);
      for await (const update of generator) {
        yield JSON.stringify(update) + "\n";
      }
    } catch (error: any) {
      throw error;
    }
  }
}

