/**
 * Gesture Recognition Engine
 * Handles recognition and execution of gestures
 */

import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import { DollarRecognizer, Point } from './recognizer';
import { Routine, RoutineCommand, RoutineManager } from './routineManager';

export interface RecognitionResult {
    recognized: boolean;
    routineName?: string;
    score: number;
    routine?: Routine;
}

export class GestureRecognitionEngine {
    private static readonly RECOGNITION_THRESHOLD = 0.80;
    private static readonly MIN_POINTS = 5;

    private routineManager: RoutineManager;
    private outputChannel: vscode.OutputChannel;

    constructor(routineManager: RoutineManager, outputChannel: vscode.OutputChannel) {
        this.routineManager = routineManager;
        this.outputChannel = outputChannel;
    }

    /**
     * Recognize a gesture (async to avoid blocking)
     */
    async recognizeAsync(points: Point[]): Promise<RecognitionResult> {
        return new Promise((resolve) => {
            // Run in next tick to avoid blocking
            setImmediate(() => {
                resolve(this.recognize(points));
            });
        });
    }

    /**
     * Recognize a gesture and return the result
     */
    recognize(points: Point[]): RecognitionResult {
        // Check minimum points
        if (points.length < GestureRecognitionEngine.MIN_POINTS) {
            this.outputChannel.appendLine(`[Recognition] Too few points: ${points.length}`);
            return {
                recognized: false,
                score: 0
            };
        }

        // Get enabled routines
        const enabledRoutines = this.routineManager.getEnabled();
        const templates = Object.entries(enabledRoutines).map(([name, routine]) => ({
            name,
            points: routine.samples
        }));

        // No routines available
        if (templates.length === 0) {
            this.outputChannel.appendLine('[Recognition] No enabled routines');
            return {
                recognized: false,
                score: 0
            };
        }

        // Perform recognition
        const result = DollarRecognizer.recognize(points, templates);
        const scorePercent = Math.round(result.score * 100);

        this.outputChannel.appendLine(
            `[Recognition] Best match: "${result.name}" (${scorePercent}%)`
        );

        // Check if score meets threshold
        if (result.score >= GestureRecognitionEngine.RECOGNITION_THRESHOLD) {
            const routine = enabledRoutines[result.name];
            return {
                recognized: true,
                routineName: result.name,
                score: result.score,
                routine
            };
        }

        return {
            recognized: false,
            routineName: result.name,
            score: result.score
        };
    }

    // Terminal reutilizable para comandos
    private codePenTerminal: vscode.Terminal | undefined;

    private getOrCreateTerminal(): vscode.Terminal {
        // Verificar si la terminal existe y está activa
        if (this.codePenTerminal) {
            const terminals = vscode.window.terminals;
            if (terminals.includes(this.codePenTerminal)) {
                return this.codePenTerminal;
            }
        }
        // Crear nueva terminal
        this.codePenTerminal = vscode.window.createTerminal('ShDraw');
        return this.codePenTerminal;
    }

    /**
     * Execute a routine (run all its commands in sequence)
     * @param routine - The routine to execute
     * @param targetEditor - Optional editor to focus before executing commands
     */
    async executeRoutine(routine: Routine, targetEditor?: vscode.TextEditor): Promise<{ success: number; failed: number }> {
        const delay = routine.delay || 0;
        let successCount = 0;
        let failCount = 0;

        const commandLabels = routine.commands.map(c =>
            typeof c === 'string' ? c : (c.label || c.command)
        ).join(' -> ');

        this.outputChannel.appendLine(`[Execution] Starting routine "${routine.name}"`);
        this.outputChannel.appendLine(`  Commands: ${commandLabels}`);
        this.outputChannel.appendLine(`  Delay: ${delay}ms`);

        // Restaurar foco al editor original antes de ejecutar comandos
        if (targetEditor && !targetEditor.document.isClosed) {
            try {
                await vscode.window.showTextDocument(targetEditor.document, targetEditor.viewColumn);
                this.outputChannel.appendLine(`  [Focus] Restored to: ${targetEditor.document.fileName}`);
            } catch {
                this.outputChannel.appendLine(`  [Focus] Could not restore editor focus`);
            }
        }

        for (let i = 0; i < routine.commands.length; i++) {
            const cmdObj = routine.commands[i];

            // Compatibilidad: si es string (rutinas antiguas), convertir a objeto
            const cmd: RoutineCommand = typeof cmdObj === 'string'
                ? { command: cmdObj, type: 'vscode-command' }
                : cmdObj;

            // Apply delay between commands (excepto si el comando actual ES un delay)
            if (i > 0 && delay > 0 && cmd.type !== 'delay') {
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            const label = cmd.label || cmd.command;
            this.outputChannel.appendLine(`  [${i + 1}/${routine.commands.length}] ${cmd.type}: ${label}`);

            try {
                switch (cmd.type) {
                    case 'delay':
                        // Ejecutar delay
                        const delayMs = parseInt(cmd.command) || 0;
                        if (delayMs > 0) {
                            await new Promise(resolve => setTimeout(resolve, delayMs));
                        }
                        break;

                    case 'terminal-command':
                        // Ejecutar en terminal
                        const terminal = this.getOrCreateTerminal();
                        terminal.show(true); // true = preservar foco
                        terminal.sendText(cmd.command);
                        break;

                    case 'vscode-command':
                    default:
                        // Ejecutar comando de VS Code
                        await vscode.commands.executeCommand(cmd.command);
                        break;
                }
                successCount++;
            } catch (err) {
                failCount++;
                const errorMsg = err instanceof Error ? err.message : String(err);
                this.outputChannel.appendLine(`  ✗ Error: ${errorMsg}`);
                vscode.window.showWarningMessage(l10n.t('Error executing: {0}', label));
            }
        }

        this.outputChannel.appendLine(
            `[Execution] Completed: ${successCount} success, ${failCount} failed`
        );

        return { success: successCount, failed: failCount };
    }

    /**
     * Recognize and execute a gesture in one call (async)
     * @param points - The gesture points
     * @param targetEditor - Optional editor to focus before executing commands
     */
    async recognizeAndExecute(points: Point[], targetEditor?: vscode.TextEditor): Promise<RecognitionResult> {
        const result = await this.recognizeAsync(points);

        if (result.recognized && result.routine) {
            const scorePercent = Math.round(result.score * 100);

            // Log only, no popup spam
            this.outputChannel.appendLine(`[Execute] Running "${result.routineName}" (${scorePercent}%)`);

            const execResult = await this.executeRoutine(result.routine, targetEditor);

            if (execResult.failed > 0) {
                this.outputChannel.appendLine(`[Execute] Completed with ${execResult.failed} error(es)`);
            }
        } else {
            const scorePercent = Math.round(result.score * 100);
            this.outputChannel.appendLine(`[Execute] Not recognized (${scorePercent}%)`);
        }

        return result;
    }
}
