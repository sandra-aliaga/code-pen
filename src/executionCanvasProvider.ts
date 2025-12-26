/**
 * Execution Canvas Webview Provider
 * Provides a persistent canvas for gesture execution
 */

import * as vscode from 'vscode';
import { Point } from './recognizer';
import { GestureRecognitionEngine } from './gestureRecognitionEngine';

export class ExecutionCanvasProvider {
    private panel: vscode.WebviewPanel | undefined;
    private recognitionEngine: GestureRecognitionEngine;
    private lastActiveEditor: vscode.TextEditor | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        recognitionEngine: GestureRecognitionEngine
    ) {
        this.recognitionEngine = recognitionEngine;
    }

    show(): void {
        // Guardar el editor activo ANTES de abrir el canvas
        this.lastActiveEditor = vscode.window.activeTextEditor;

        // Always create new panel, dispose old if exists
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }

        this.panel = vscode.window.createWebviewPanel(
            'codePenExecutionCanvas',
            'Code Pen - Ejecutar',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: false
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        this.panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'recognizeGesture') {
                await this.handleRecognition(message.points);
            }
        });
    }

    private async handleRecognition(points: Point[]): Promise<void> {
        const result = await this.recognitionEngine.recognizeAndExecute(points, this.lastActiveEditor);

        // Send result back to webview (no popup, solo feedback en canvas)
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'recognitionResult',
                recognized: result.recognized,
                routineName: result.routineName,
                score: result.score
            });
        }
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Pen - Ejecutar</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--vscode-editor-background);
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            padding: 16px;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
        }

        h1 {
            font-size: 1.2em;
            margin-bottom: 12px;
        }

        .instructions {
            font-size: 13px;
            opacity: 0.7;
            margin-bottom: 16px;
        }

        #canvas {
            border: 2px solid var(--vscode-panel-border);
            border-radius: 4px;
            cursor: crosshair;
            background: var(--vscode-editor-background);
            display: block;
            margin: 0 auto;
        }

        #canvas.drawing {
            border-color: var(--vscode-focusBorder);
        }

        .feedback {
            margin-top: 12px;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            display: none;
        }

        .feedback.visible {
            display: block;
        }

        .feedback.success {
            background: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
        }

        .feedback.failure {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }

        .stats {
            margin-top: 12px;
            font-size: 12px;
            opacity: 0.6;
            display: flex;
            gap: 16px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>[+] Ejecutar Gestos</h1>
        <div class="instructions">
            Dibuja un gesto para ejecutar una rutina (Ctrl+Alt+D)
        </div>

        <canvas id="canvas" width="500" height="350"></canvas>

        <div id="feedback" class="feedback"></div>

        <div class="stats">
            <span>Dibujados: <strong id="gestureCount">0</strong></span>
            <span>Reconocidos: <strong id="recognizedCount">0</strong></span>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const feedback = document.getElementById('feedback');
        const gestureCountEl = document.getElementById('gestureCount');
        const recognizedCountEl = document.getElementById('recognizedCount');

        let isDrawing = false;
        let points = [];
        let gestureCount = 0;
        let recognizedCount = 0;
        let isProcessing = false; // Debounce: evitar múltiples reconocimientos simultáneos
        let processingTimeout = null; // Timeout de seguridad
        const MAX_POINTS = 500; // Limitar puntos para evitar lag
        const PROCESSING_TIMEOUT_MS = 5000; // Timeout máximo para procesar

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;

        function getStrokeColor() {
            return getComputedStyle(document.documentElement)
                .getPropertyValue('--vscode-editorCursor-foreground').trim() || '#007acc';
        }

        ctx.strokeStyle = getStrokeColor();

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);

        function startDrawing(e) {
            isDrawing = true;
            points = [];
            canvas.classList.add('drawing');
            feedback.classList.remove('visible');
            ctx.strokeStyle = getStrokeColor();
            draw(e);
        }

        function draw(e) {
            if (!isDrawing) return;
            // Limitar puntos para evitar lag con gestos muy largos
            if (points.length >= MAX_POINTS) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            points.push({ x, y });
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        }

        function stopDrawing() {
            if (!isDrawing) return;
            isDrawing = false;
            canvas.classList.remove('drawing');
            ctx.beginPath();

            if (points.length > 5) {
                // Debounce: evitar enviar si ya hay un reconocimiento en proceso
                if (isProcessing) {
                    showFeedback('Procesando...', 'failure');
                    points = [];
                    setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 300);
                    return;
                }

                isProcessing = true;
                gestureCount++;
                gestureCountEl.textContent = gestureCount;

                // Timeout de seguridad: resetear isProcessing si no hay respuesta
                if (processingTimeout) clearTimeout(processingTimeout);
                processingTimeout = setTimeout(() => {
                    if (isProcessing) {
                        isProcessing = false;
                        showFeedback('Timeout - reintenta', 'failure');
                        setTimeout(() => showFeedback('', 'failure'), 2000);
                    }
                }, PROCESSING_TIMEOUT_MS);

                vscode.postMessage({
                    command: 'recognizeGesture',
                    points: points
                });
            } else {
                showFeedback('Gesto muy corto', 'failure');
            }

            setTimeout(() => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }, 300);

            points = [];
        }

        function showFeedback(text, type) {
            feedback.textContent = text;
            feedback.className = 'feedback visible ' + type;
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'recognitionResult') {
                isProcessing = false; // Permitir nuevo reconocimiento
                if (processingTimeout) {
                    clearTimeout(processingTimeout);
                    processingTimeout = null;
                }
                const score = Math.round(message.score * 100);
                if (message.recognized) {
                    recognizedCount++;
                    recognizedCountEl.textContent = recognizedCount;
                    showFeedback('[OK] ' + message.routineName + ' (' + score + '%)', 'success');
                    setTimeout(() => feedback.classList.remove('visible'), 2000);
                } else {
                    const text = message.routineName
                        ? '[X] No reconocido (mejor: ' + message.routineName + ' ' + score + '%)'
                        : '[X] No reconocido';
                    showFeedback(text, 'failure');
                    setTimeout(() => feedback.classList.remove('visible'), 3000);
                }
            }
        });
    </script>
</body>
</html>`;
    }
}
