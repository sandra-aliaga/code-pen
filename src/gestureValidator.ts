/**
 * Gesture Validator
 * Validates that new gestures are sufficiently different from existing ones
 */

import { DollarRecognizer, Point } from './recognizer';

export interface ValidationResult {
    isValid: boolean;
    similarTo?: string;
    score: number;
    message: string;
}

export class GestureValidator {
    // Threshold debe ser menor que RECOGNITION_THRESHOLD (0.80) para evitar
    // que gestos válidos no sean reconocidos
    private static readonly SIMILARITY_THRESHOLD = 0.78;
    private static readonly MIN_POINTS = 5;

    /**
     * Validates if a new gesture is sufficiently different from existing ones
     * @param candidatePoints Points of the new gesture
     * @param existingGestures Map of existing routine names to their gesture samples
     * @param excludeRoutineName Optional routine name to exclude from validation (for editing)
     * @returns ValidationResult with isValid flag and details
     */
    static validate(
        candidatePoints: Point[],
        existingGestures: Record<string, Point[][]>,
        excludeRoutineName?: string
    ): ValidationResult {
        // Check minimum points
        if (candidatePoints.length < this.MIN_POINTS) {
            return {
                isValid: false,
                score: 0,
                message: `Muy corto (min ${this.MIN_POINTS} puntos)`
            };
        }

        // Prepare templates from existing gestures (excluding the one being edited)
        const templates = Object.entries(existingGestures)
            .filter(([name]) => name !== excludeRoutineName)
            .map(([name, samples]) => ({
                name,
                points: samples
            }));

        // No existing gestures to compare against
        if (templates.length === 0) {
            return {
                isValid: true,
                score: 0,
                message: 'OK'
            };
        }

        // Recognize against existing gestures
        const result = DollarRecognizer.recognize(candidatePoints, templates);

        // Check if too similar (only to OTHER routines, not same routine being created)
        if (result.score > this.SIMILARITY_THRESHOLD) {
            return {
                isValid: false,
                similarTo: result.name,
                score: result.score,
                message: `Muy similar (${Math.round(result.score * 100)}%) a "${result.name}"`
            };
        }

        return {
            isValid: true,
            score: result.score,
            message: 'OK'
        };
    }

    /**
     * Get similarity between a gesture and an existing routine
     */
    static getSimilarity(
        candidatePoints: Point[],
        routineSamples: Point[][]
    ): number {
        if (candidatePoints.length < this.MIN_POINTS || routineSamples.length === 0) {
            return 0;
        }

        const templates = [{ name: 'target', points: routineSamples }];
        const result = DollarRecognizer.recognize(candidatePoints, templates);
        return result.score;
    }
}
