/**
 * The $1 Unistroke Recognizer (JavaScript version)
 *
 *  M. Wobbrock, A.D. Wilson, Y. Li. 
 *  "Gestures without Libraries, Toolkits or Training: A $1 Recognizer for User Interface Prototypes." 
 *  UIST 2007.
 */

export interface Point {
    x: number;
    y: number;
}

export interface Result {
    name: string;
    score: number;
}

const NumPoints = 64;
const SquareSize = 250.0;
const Origin: Point = { x: 0, y: 0 };
const Diagonal = Math.sqrt(SquareSize * SquareSize + SquareSize * SquareSize);
const HalfDiagonal = 0.5 * Diagonal;
const AngleRange = 45.0;
const AnglePrecision = 2.0;
const Phi = 0.5 * (-1.0 + Math.sqrt(5.0)); // Golden Ratio

export class DollarRecognizer {
    
    // Recognize a gesture against a set of templates
    // templates: { name: string, points: Point[] }[]
    // candidate: Point[] (the raw input stroke)
    static recognize(candidateRaw: Point[], templates: { name: string, points: Point[][] }[]): Result {
        if (candidateRaw.length < 5) {
            return { name: "", score: 0 };
        }

        // 1. Normalize the candidate
        const candidate = this.normalize(candidateRaw);

        let bestDistance = Infinity;
        let bestTemplate = "";

        // 2. Compare against all templates
        // Note: templates input has multiple samples per command (points[][])
        // We flatten this structure to compare against every sample of every command
        for (const templateGroup of templates) {
            const commandName = templateGroup.name;
            const samples = templateGroup.points;

            for (const sampleRaw of samples) {
                const sample = this.normalize(sampleRaw);
                
                // Calculate distance (Golden Section Search)
                const distance = this.distanceAtBestAngle(candidate, sample, -AngleRange, +AngleRange, AnglePrecision);
                
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestTemplate = commandName;
                }
            }
        }

        const score = 1.0 - (bestDistance / HalfDiagonal);
        return { name: bestTemplate, score: score };
    }

    // --- Helper Pipeline Steps ---

    static normalize(points: Point[]): Point[] {
        let newPoints = this.resample(points, NumPoints);
        const radians = this.indicativeAngle(newPoints);
        newPoints = this.rotateBy(newPoints, -radians);
        newPoints = this.scaleToSquare(newPoints, SquareSize);
        newPoints = this.translateToOrigin(newPoints);
        return newPoints;
    }

    static resample(points: Point[], n: number): Point[] {
        const I = this.pathLength(points) / (n - 1);
        let D = 0.0;
        const newPoints: Point[] = [points[0]];
        
        // Clone points to avoid modifying original
        const srcPts = [...points];
        
        let i = 1;
        while (i < srcPts.length) {
            const d = this.distance(srcPts[i - 1], srcPts[i]);
            if ((D + d) >= I) {
                const qx = srcPts[i - 1].x + ((I - D) / d) * (srcPts[i].x - srcPts[i - 1].x);
                const qy = srcPts[i - 1].y + ((I - D) / d) * (srcPts[i].y - srcPts[i - 1].y);
                const q = { x: qx, y: qy };
                newPoints.push(q);
                srcPts.splice(i, 0, q); // Insert 'q' at position i so that it effectively becomes the next p[i-1]
                D = 0.0;
            } else {
                D += d;
                i++;
            }
        }
        
        if (newPoints.length === n - 1) {
            newPoints.push(srcPts[srcPts.length - 1]);
        }
        return newPoints;
    }

    static indicativeAngle(points: Point[]): number {
        const c = this.centroid(points);
        return Math.atan2(c.y - points[0].y, c.x - points[0].x);
    }

    static rotateBy(points: Point[], radians: number): Point[] {
        const c = this.centroid(points);
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        return points.map(p => {
            return {
                x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
                y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y
            };
        });
    }

    static scaleToSquare(points: Point[], size: number): Point[] {
        const B = this.boundingBox(points);
        const newPoints: Point[] = [];
        points.forEach(p => {
            const qx = p.x * (size / B.width);
            const qy = p.y * (size / B.height);
            newPoints.push({ x: qx, y: qy });
        });
        return newPoints;
    }

    static translateToOrigin(points: Point[]): Point[] {
        const c = this.centroid(points);
        return points.map(p => {
            return {
                x: p.x - c.x,
                y: p.y - c.y
            };
        });
    }

    static distanceAtBestAngle(points: Point[], T: Point[], a: number, b: number, threshold: number): number {
        let x1 = Phi * a + (1.0 - Phi) * b;
        let f1 = this.distanceAtAngle(points, T, x1);
        let x2 = (1.0 - Phi) * a + Phi * b;
        let f2 = this.distanceAtAngle(points, T, x2);
        
        while (Math.abs(b - a) > threshold) {
            if (f1 < f2) {
                b = x2;
                x2 = x1;
                f2 = f1;
                x1 = Phi * a + (1.0 - Phi) * b;
                f1 = this.distanceAtAngle(points, T, x1);
            } else {
                a = x1;
                x1 = x2;
                f1 = f2;
                x2 = (1.0 - Phi) * a + Phi * b;
                f2 = this.distanceAtAngle(points, T, x2);
            }
        }
        return Math.min(f1, f2);
    }

    static distanceAtAngle(points: Point[], T: Point[], radians: number): number {
        const newPoints = this.rotateBy(points, radians);
        return this.pathDistance(newPoints, T);
    }

    static pathDistance(pts1: Point[], pts2: Point[]): number {
        let d = 0.0;
        // Typically pts1 and pts2 have same length after resampling
        const len = Math.min(pts1.length, pts2.length); 
        for (let i = 0; i < len; i++) {
            d += this.distance(pts1[i], pts2[i]);
        }
        return d / len;
    }

    static pathLength(points: Point[]): number {
        let d = 0.0;
        for (let i = 1; i < points.length; i++) {
            d += this.distance(points[i - 1], points[i]);
        }
        return d;
    }

    static distance(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static centroid(points: Point[]): Point {
        let x = 0.0, y = 0.0;
        points.forEach(p => {
            x += p.x;
            y += p.y;
        });
        return { x: x / points.length, y: y / points.length };
    }

    static boundingBox(points: Point[]): { x: number, y: number, width: number, height: number } {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    static toDegree(radians: number) { 
        return (radians * 180.0) / Math.PI; 
    }
    
    static toRadians(degree: number) { 
        return (degree * Math.PI) / 180.0; 
    }
}
