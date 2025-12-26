/**
 * Routine Manager
 * Handles storage and retrieval of routines
 */

import * as vscode from 'vscode';
import { DollarRecognizer, Point } from './recognizer';

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
     * @throws Error if routine data is invalid
     */
    async save_routine(routine: Routine): Promise<void> {
        // Validación de entrada
        if (!routine.name || routine.name.trim().length === 0) {
            throw new Error('El nombre de la rutina no puede estar vacío');
        }
        if (!routine.commands || routine.commands.length === 0) {
            throw new Error('La rutina debe tener al menos un comando');
        }
        if (!routine.samples || routine.samples.length === 0) {
            throw new Error('La rutina debe tener al menos una muestra de gesto');
        }

        const now = Date.now();
        const existing = this.routines[routine.name.trim()];

        this.routines[routine.name.trim()] = {
            ...routine,
            name: routine.name.trim(),
            createdAt: existing?.createdAt || now,
            updatedAt: now,
            enabled: routine.enabled ?? true
        };

        await this.save();

        // Limpiar cache del algoritmo $1
        DollarRecognizer.clearCache();
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
