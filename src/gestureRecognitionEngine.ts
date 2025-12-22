/**
 * Gesture Recognition Engine
 * Handles recognition and execution of gestures
 */

import * as vscode from 'vscode';
import { DollarRecognizer, Point } from './recognizer';
import { Routine, RoutineManager } from './routineManager';

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

    /**
     * Execute a routine (run all its commands in sequence)
     */
    async executeRoutine(routine: Routine): Promise<{ success: number; failed: number }> {
        const delay = routine.delay || 0;
        let successCount = 0;
        let failCount = 0;

        this.outputChannel.appendLine(`[Execution] Starting routine "${routine.name}"`);
        this.outputChannel.appendLine(`  Commands: ${routine.commands.join(' -> ')}`);
        this.outputChannel.appendLine(`  Delay: ${delay}ms`);

        for (let i = 0; i < routine.commands.length; i++) {
            const cmd = routine.commands[i];

            // Apply delay between commands
            if (i > 0 && delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            this.outputChannel.appendLine(`  [${i + 1}/${routine.commands.length}] Executing: ${cmd}`);

            try {
                await vscode.commands.executeCommand(cmd);
                successCount++;
            } catch (err) {
                failCount++;
                const errorMsg = err instanceof Error ? err.message : String(err);
                this.outputChannel.appendLine(`  ✗ Error: ${errorMsg}`);
                vscode.window.showWarningMessage(`Error ejecutando comando: ${cmd}`);
            }
        }

        this.outputChannel.appendLine(
            `[Execution] Completed: ${successCount} success, ${failCount} failed`
        );

        return { success: successCount, failed: failCount };
    }

    /**
     * Recognize and execute a gesture in one call (async)
     */
    async recognizeAndExecute(points: Point[]): Promise<RecognitionResult> {
        const result = await this.recognizeAsync(points);

        if (result.recognized && result.routine) {
            const scorePercent = Math.round(result.score * 100);
            
            // Log only, no popup spam
            this.outputChannel.appendLine(`[Execute] Running "${result.routineName}" (${scorePercent}%)`);

            const execResult = await this.executeRoutine(result.routine);

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
