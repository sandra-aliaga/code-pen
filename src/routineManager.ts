/**
 * Routine Manager
 * Handles storage and retrieval of routines
 */

import * as vscode from 'vscode';
import { Point } from './recognizer';

export interface Routine {
    name: string;
    commands: string[];
    samples: Point[][];
    enabled?: boolean;
    delay?: number;
    createdAt?: number;
    updatedAt?: number;
}

export class RoutineManager {
    private static readonly STORAGE_KEY = 'codePen.routines';
    private routines: Record<string, Routine> = {};
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.load();
    }

    /**
     * Load routines from storage
     */
    private load(): void {
        this.routines = this.context.globalState.get(RoutineManager.STORAGE_KEY, {});
        console.log('[RoutineManager] Loaded routines:', Object.keys(this.routines));
    }

    /**
     * Save routines to storage
     */
    private async save(): Promise<void> {
        await this.context.globalState.update(RoutineManager.STORAGE_KEY, this.routines);
        console.log('[RoutineManager] Saved routines:', Object.keys(this.routines));
    }

    /**
     * Get all routines
     */
    getAll(): Record<string, Routine> {
        return { ...this.routines };
    }

    /**
     * Get a specific routine
     */
    get(name: string): Routine | undefined {
        return this.routines[name];
    }

    /**
     * Get all enabled routines
     */
    getEnabled(): Record<string, Routine> {
        const enabled: Record<string, Routine> = {};
        for (const [name, routine] of Object.entries(this.routines)) {
            if (routine.enabled !== false) {
                enabled[name] = routine;
            }
        }
        return enabled;
    }

    /**
     * Create or update a routine
     */
    async save_routine(routine: Routine): Promise<void> {
        const now = Date.now();
        const existing = this.routines[routine.name];

        this.routines[routine.name] = {
            ...routine,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
            enabled: routine.enabled ?? true
        };

        await this.save();
        
        // Limpiar cache del algoritmo $1
        try {
            const { DollarRecognizer } = await import('./recognizer.js');
            DollarRecognizer.clearCache();
        } catch (e) {
            // Ignore if import fails
        }
    }

    /**
     * Delete a routine
     */
    async delete(name: string): Promise<boolean> {
        if (!this.routines[name]) {
            return false;
        }
        delete this.routines[name];
        await this.save();
        return true;
    }

    /**
     * Toggle routine enabled/disabled
     */
    async toggle(name: string): Promise<boolean> {
        const routine = this.routines[name];
        if (!routine) {
            return false;
        }
        routine.enabled = !(routine.enabled ?? true);
        routine.updatedAt = Date.now();
        await this.save();
        return true;
    }

    /**
     * Check if a routine name exists
     */
    exists(name: string): boolean {
        return !!this.routines[name];
    }

    /**
     * Get gesture samples from all routines (for validation)
     */
    getAllGestures(): Record<string, Point[][]> {
        const gestures: Record<string, Point[][]> = {};
        for (const [name, routine] of Object.entries(this.routines)) {
            if (routine.samples && routine.samples.length > 0) {
                gestures[name] = routine.samples;
            }
        }
        return gestures;
    }
}
