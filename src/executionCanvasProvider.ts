/**
 * Execution Canvas Webview Provider
 * Provides a persistent canvas for gesture execution
 */

import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
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
            'shdrawExecutionCanvas',
            l10n.t('ShDraw - Execute'),
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: false,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview')
                ]
            }
        );

        this.panel.webview.html = this.getWebviewContent(this.panel.webview);

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

    private getWebviewContent(webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'executionCanvas.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'executionCanvas.js')
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${l10n.t('ShDraw - Execute')}</title>
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <div class="header">
        <h1>Ejecutar Gestos</h1>
        <div class="instructions">Dibuja un gesto para ejecutar una rutina</div>
    </div>

    <div class="canvas-wrapper">
        <canvas id="canvas"></canvas>
    </div>

    <div id="feedback" class="feedback"></div>

    <div class="footer">
        <div class="stats">
            <span>Dibujados: <strong id="gestureCount">0</strong></span>
            <span>Reconocidos: <strong id="recognizedCount">0</strong></span>
        </div>
    </div>

    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}
