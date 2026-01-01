/**
 * Configuration Webview Provider
 * Provides UI for creating and managing routines
 */

import * as vscode from "vscode";
import * as l10n from '@vscode/l10n';
import { Block, PREDEFINED_BLOCKS } from "./blocks";
import { GestureValidator } from "./gestureValidator";
import { Point } from "./recognizer";
import { Routine, RoutineManager } from "./routineManager";

export class ConfigurationWebviewProvider {
    private panel: vscode.WebviewPanel | undefined;
    private routineManager: RoutineManager;
    private outputChannel: vscode.OutputChannel;

    constructor(
        private context: vscode.ExtensionContext,
        routineManager: RoutineManager,
        outputChannel: vscode.OutputChannel
    ) {
        this.routineManager = routineManager;
        this.outputChannel = outputChannel;
    }

    async show(): Promise<void> {
        // Always create new panel
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }

        this.panel = vscode.window.createWebviewPanel(
            "shdrawConfig",
            l10n.t("ShDraw - Configure"),
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: false,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview')
                ]
            }
        );

        // Obtener todos los comandos de VS Code
        const allCommands = await vscode.commands.getCommands(true);
        // Filtrar comandos internos (que empiezan con _)
        const filteredCommands = allCommands.filter(cmd => !cmd.startsWith("_")).sort();

        this.updateWebviewContent(filteredCommands);

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        this.panel.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case "log":
                    this.outputChannel.appendLine(message.text);
                    break;
                case "saveRoutine":
                    await this.handleSaveRoutine(message);
                    break;
                case "deleteRoutine":
                    await this.handleDeleteRoutine(message.name);
                    break;
                case "toggleRoutine":
                    await this.handleToggleRoutine(message.name);
                    break;
                case "validateGesture":
                    await this.handleValidateGesture(message);
                    break;
                case "testRoutine":
                    await this.handleTestRoutine(message);
                    break;
            }
        });
    }

    private cachedCommands: string[] = [];

    /**
     * Update webview content with current routines
     */
    private updateWebviewContent(commands?: string[]): void {
        if (!this.panel) return;

        if (commands) {
            this.cachedCommands = commands;
        }

        const routines = this.routineManager.getAll();
        this.panel.webview.html = this.getWebviewContent(this.panel.webview, PREDEFINED_BLOCKS, routines, this.cachedCommands);
    }

    /**
     * Send updated routines to webview
     */
    private sendRoutinesUpdate(): void {
        if (!this.panel) return;

        const routines = this.routineManager.getAll();
        this.panel.webview.postMessage({
            command: "routinesUpdated",
            routines,
        });
    }

    /**
     * Handle save routine message
     */
    private async handleSaveRoutine(message: any): Promise<void> {
        const routine: Routine = {
            name: message.name,
            commands: message.commands,
            samples: message.samples,
            delay: message.delay || 0,
        };

        try {
            await this.routineManager.save_routine(routine);

            vscode.window.showInformationMessage(
                l10n.t('Routine saved: "{0}" ({1} commands)', message.name, message.commands.length)
            );

            this.outputChannel.appendLine(
                `[Config] Saved routine "${message.name}". Commands: ${message.commands.join(" -> ")}`
            );

            this.sendRoutinesUpdate();
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(l10n.t('Error saving routine: {0}', errorMsg));
            this.outputChannel.appendLine(`[Config] Error saving routine: ${errorMsg}`);
        }
    }

    /**
     * Handle delete routine message
     */
    private async handleDeleteRoutine(name: string): Promise<void> {
        this.outputChannel.appendLine(`[Delete] Deleting routine: ${name}`);
        const deleted = await this.routineManager.delete(name);

        if (deleted) {
            this.outputChannel.appendLine(`[Delete] Success`);
            this.sendRoutinesUpdate();
        } else {
            this.outputChannel.appendLine(`[Delete] Failed`);
        }
    }

    /**
     * Handle toggle routine message
     */
    private async handleToggleRoutine(name: string): Promise<void> {
        await this.routineManager.toggle(name);
        this.sendRoutinesUpdate();
    }

    private async handleValidateGesture(message: any): Promise<void> {
        if (!this.panel) {
            return;
        }

        // Validacion con algoritmo $1 pero SIN bloquear
        setTimeout(() => {
            try {
                const allRoutines = this.routineManager.getAll();
                const existingGestures: Record<string, Point[][]> = {};

                // Solo validar contra rutinas DIFERENTES (ya guardadas)
                for (const [name, routine] of Object.entries(allRoutines)) {
                    if (routine.samples && routine.samples.length > 0) {
                        existingGestures[name] = routine.samples;
                    }
                }

                // Si no hay rutinas guardadas, aceptar
                if (Object.keys(existingGestures).length === 0) {
                    this.panel?.webview.postMessage({
                        command: "gestureValidation",
                        requestId: message.requestId,
                        isValid: true,
                        score: 1.0,
                        message: "OK",
                    });
                    return;
                }

                // Validar con algoritmo $1 (excluir rutina siendo editada)
                const validation = GestureValidator.validate(message.points, existingGestures, message.excludeRoutineName);

                this.panel?.webview.postMessage({
                    command: "gestureValidation",
                    requestId: message.requestId,
                    isValid: validation.isValid,
                    similarTo: validation.similarTo,
                    score: validation.score,
                    message: validation.message,
                });
            } catch (err) {
                // Si falla, aceptar
                this.panel?.webview.postMessage({
                    command: "gestureValidation",
                    requestId: message.requestId,
                    isValid: true,
                    score: 1.0,
                    message: "OK",
                });
            }
        }, 0);
    }

    // Terminal para testing
    private testTerminal: vscode.Terminal | undefined;

    private getOrCreateTestTerminal(): vscode.Terminal {
        if (this.testTerminal) {
            const terminals = vscode.window.terminals;
            if (terminals.includes(this.testTerminal)) {
                return this.testTerminal;
            }
        }
        this.testTerminal = vscode.window.createTerminal('ShDraw Test');
        return this.testTerminal;
    }

    /**
     * Handle test routine message
     */
    private async handleTestRoutine(message: any): Promise<void> {
        const delay = message.delay || 0;

        vscode.window.showInformationMessage(
            delay > 0
                ? l10n.t('Testing routine... (delay: {0}ms)', delay)
                : l10n.t('Testing routine...')
        );

        const commandLabels = message.commands.map((c: any) =>
            typeof c === 'string' ? c : (c.label || c.command)
        ).join(" -> ");

        this.outputChannel.appendLine(`[Config] Testing routine: ${commandLabels} (delay: ${delay}ms)`);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < message.commands.length; i++) {
            const cmdObj = message.commands[i];

            // Compatibilidad: si es string, convertir a objeto
            const cmd = typeof cmdObj === 'string'
                ? { command: cmdObj, type: 'vscode-command' as const }
                : cmdObj;

            // Apply delay (excepto para delays)
            if (i > 0 && delay > 0 && cmd.type !== 'delay') {
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            const label = cmd.label || cmd.command;
            this.outputChannel.appendLine(`  -> [${cmd.type}] ${label}`);

            try {
                switch (cmd.type) {
                    case 'delay':
                        const delayMs = parseInt(cmd.command) || 0;
                        if (delayMs > 0) {
                            await new Promise(resolve => setTimeout(resolve, delayMs));
                        }
                        break;

                    case 'terminal-command':
                        const terminal = this.getOrCreateTestTerminal();
                        terminal.show(true);
                        terminal.sendText(cmd.command);
                        break;

                    case 'vscode-command':
                    default:
                        await vscode.commands.executeCommand(cmd.command);
                        break;
                }
                successCount++;
            } catch (err) {
                failCount++;
                const errorMsg = err instanceof Error ? err.message : String(err);
                this.outputChannel.appendLine(`  -> Error: ${errorMsg}`);
                vscode.window.showWarningMessage(l10n.t('Error in: {0}', label));
            }
        }

        if (failCount === 0) {
            vscode.window.showInformationMessage(l10n.t('Test completed: {0} commands OK', successCount));
        } else {
            vscode.window.showWarningMessage(l10n.t('Test completed with {0} error(s)', failCount));
        }
    }

    /**
     * Get the HTML content for the webview
     */
    private getWebviewContent(webview: vscode.Webview, blocks: Block[], routines: Record<string, Routine>, allCommands: string[]): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'configuration.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'configuration.js')
        );

        const blocksJson = JSON.stringify(blocks);
        const routinesJson = JSON.stringify(routines);
        const commandsJson = JSON.stringify(allCommands);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${l10n.t('ShDraw - Configure Routines')}</title>
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    ${this.getBodyHTML()}
    <script>
        window.BLOCKS_DATA = ${blocksJson};
        window.ROUTINES_DATA = ${routinesJson};
        window.COMMANDS_DATA = ${commandsJson};
    </script>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }


    private getBodyHTML(): string {
        return `
    <div id="mainView" class="view active">
        <h1>Configurar Rutinas</h1>
        <button id="btnNewRoutine">Nueva Rutina</button>
        <div id="routineList" class="routine-list"></div>
    </div>

    <div id="createView" class="view">
        <h1>Nueva Rutina</h1>

        <div id="step1" class="step active">
            <div class="create-container">
                <div class="form-row">
                    <div class="form-field">
                        <h3>Nombre</h3>
                        <input type="text" id="routineName" placeholder="Ej: Modo Focus, Deploy Rápido...">
                    </div>
                    <div class="form-field form-field-small">
                        <h3>Delay entre comandos</h3>
                        <input type="number" id="routineDelay" value="0" min="0" max="5000" step="100" placeholder="0 ms">
                    </div>
                </div>

                <div class="custom-inputs-grid">
                    <div class="custom-input-box">
                        <h3>Comando VS Code</h3>
                        <div class="input-row">
                            <div class="command-search-container">
                                <input type="text" id="customCommandInput" placeholder="Buscar comando..." autocomplete="off">
                                <div id="commandDropdown" class="command-dropdown"></div>
                            </div>
                            <button id="btnAddCustomCommand">+</button>
                        </div>
                        <div id="commandCount" class="command-count"></div>
                    </div>

                    <div class="custom-input-box terminal-box">
                        <h3>Comando Terminal</h3>
                        <div class="input-row">
                            <input type="text" id="terminalCommandInput" placeholder="npm run build, git status...">
                            <button id="btnAddTerminalCommand" class="terminal-btn">+</button>
                        </div>
                    </div>

                    <div class="custom-input-box delay-box">
                        <h3>Delay (ms)</h3>
                        <div class="input-row">
                            <input type="number" id="delayInput" placeholder="1000" min="0" max="30000">
                            <button id="btnAddDelay" class="delay-btn">+</button>
                        </div>
                    </div>
                </div>

                <div class="blocks-section">
                    <div class="blocks-available">
                        <h2>Bloques Disponibles</h2>
                        <div id="blocksContainer"></div>
                    </div>
                    <div class="blocks-selected">
                        <h2>Secuencia de Comandos</h2>
                        <div id="selectedBlocks" class="selected-list empty"></div>
                    </div>
                </div>

                <div class="nav-buttons">
                    <button class="secondary" id="btnCancelCreate">Cancelar</button>
                    <button class="secondary" id="btnTestRoutine" disabled>Probar</button>
                    <button id="btnNextStep" disabled>Siguiente</button>
                </div>
                <div id="step1Hint" class="hint-text"></div>
            </div>
        </div>

        <div id="step2" class="step">
            <div class="canvas-container">
                <h2>Dibujar Gesto</h2>
                <p>Rutina: <strong><span id="gestureRoutineName"></span></strong></p>
                <p>Dibuja el mismo gesto 3 veces para registrarlo</p>

                <div class="sample-indicators">
                    <span class="sample-dot" id="dot1"></span>
                    <span class="sample-dot" id="dot2"></span>
                    <span class="sample-dot" id="dot3"></span>
                </div>

                <canvas id="drawingCanvas" width="400" height="300"></canvas>

                <div id="validationMessage" class="validation-message"></div>

                <div class="nav-buttons">
                    <button class="secondary" id="btnBackStep">Atrás</button>
                    <button id="btnSaveRoutine" disabled>Guardar</button>
                </div>
            </div>
        </div>
    </div>`;
    }
}
