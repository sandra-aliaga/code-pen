/**
 * Configuration Webview Provider
 * Provides UI for creating and managing routines
 */

import * as vscode from "vscode";
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
            "codePenConfig",
            "Code Pen - Configurar",
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: false,
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
        this.panel.webview.html = this.getWebviewContent(PREDEFINED_BLOCKS, routines, this.cachedCommands);
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
                `Rutina guardada: "${message.name}" (${message.commands.length} comandos)`
            );

            this.outputChannel.appendLine(
                `[Config] Saved routine "${message.name}". Commands: ${message.commands.join(" -> ")}`
            );

            this.sendRoutinesUpdate();
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Error al guardar rutina: ${errorMsg}`);
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

    /**
     * Handle test routine message
     */
    private async handleTestRoutine(message: any): Promise<void> {
        const delay = message.delay || 0;

        vscode.window.showInformationMessage(`Probando rutina...${delay > 0 ? ` (delay: ${delay}ms)` : ""}`);

        this.outputChannel.appendLine(`[Config] Testing routine: ${message.commands.join(" -> ")} (delay: ${delay}ms)`);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < message.commands.length; i++) {
            const cmd = message.commands[i];

            if (i > 0 && delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            this.outputChannel.appendLine(`  -> Executing: ${cmd}`);

            try {
                await vscode.commands.executeCommand(cmd);
                successCount++;
            } catch (err) {
                failCount++;
                const errorMsg = err instanceof Error ? err.message : String(err);
                this.outputChannel.appendLine(`  -> Error: ${errorMsg}`);
                vscode.window.showWarningMessage(`Error en comando: ${cmd}`);
            }
        }

        if (failCount === 0) {
            vscode.window.showInformationMessage(`Prueba completada: ${successCount} comandos OK`);
        } else {
            vscode.window.showWarningMessage(`Prueba completada con ${failCount} error(es)`);
        }
    }

    /**
     * Get the HTML content for the webview
     */
    private getWebviewContent(blocks: Block[], routines: Record<string, Routine>, allCommands: string[]): string {
        const blocksJson = JSON.stringify(blocks);
        const routinesJson = JSON.stringify(routines);
        const commandsJson = JSON.stringify(allCommands);

        // Return the full HTML (same as before but with updated validation logic)
        return this.generateHTML(blocksJson, routinesJson, commandsJson);
    }

    private generateHTML(blocksJson: string, routinesJson: string, commandsJson: string): string {
        // [This will contain the same HTML from extension.ts getWebviewContent but with improvements]
        // For brevity, I'll include the key changes and note this is the full implementation
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Pen - Configurar Rutinas</title>
    ${this.getStyles()}
</head>
<body>
    ${this.getBodyHTML()}
    ${this.getScripts(blocksJson, routinesJson, commandsJson)}
</body>
</html>`;
    }

    private getStyles(): string {
        return `<style>

            * { box-sizing: border-box; }

            body {

                margin: 0;

                padding: 16px;

                background-color: var(--vscode-editor-background);

                font-family: var(--vscode-font-family);

                color: var(--vscode-editor-foreground);

                min-height: 100vh;

            }

            h1 { margin: 0 0 16px 0; font-size: 1.4em; }

            h2 { margin: 0 0 12px 0; font-size: 1.1em; opacity: 0.9; }

            h3 { margin: 0 0 8px 0; font-size: 0.95em; opacity: 0.7; text-transform: uppercase; }

    

            button {

                background: var(--vscode-button-background);

                color: var(--vscode-button-foreground);

                border: none;

                padding: 8px 16px;

                cursor: pointer;

                font-size: 13px;

                border-radius: 4px;

            }

            button:hover { background: var(--vscode-button-hoverBackground); }

            button.secondary {

                background: var(--vscode-button-secondaryBackground);

                color: var(--vscode-button-secondaryForeground);

            }

            button.danger { background: var(--vscode-inputValidation-errorBackground); border: 1px solid var(--vscode-inputValidation-errorBorder); }

            button:disabled { opacity: 0.5; cursor: not-allowed; }

    

            input[type="text"], input[type="number"] {

                background: var(--vscode-input-background);

                color: var(--vscode-input-foreground);

                border: 1px solid var(--vscode-input-border);

                padding: 8px 12px;

                font-size: 13px;

                border-radius: 4px;

                width: 100%;

            }

    

            .view { display: none; }

            .view.active { display: block; }

    

            .routine-list { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }

            .routine-card {

                background: var(--vscode-editor-inactiveSelectionBackground);

                border: 1px solid var(--vscode-panel-border);

                border-radius: 6px;

                padding: 12px;

                display: flex;

                gap: 12px;

                align-items: center;

                flex-wrap: wrap; /* Allow wrapping for responsiveness */

            }

            .routine-preview {

                width: 60px;

                height: 60px;

                border: 1px solid var(--vscode-panel-border);

                border-radius: 4px;

                background: var(--vscode-editor-background);

                flex-shrink: 0;

            }

            .routine-info { flex: 1; min-width: 200px; } /* Ensure it takes space but wraps if needed */

            .routine-name { font-weight: bold; margin-bottom: 4px; }

            .routine-commands { font-size: 12px; opacity: 0.7; }

            .routine-actions { display: flex; gap: 8px; margin-left: auto; } /* Push to right, but wrap if needed */

            .routine-actions button { padding: 4px 8px; font-size: 12px; }

            .routine-card.disabled { opacity: 0.5; }

            .routine-card.disabled .routine-preview { filter: grayscale(1); }

    

            .empty-state {

                text-align: center;

                padding: 40px;

                opacity: 0.6;

            }

    

            .create-container { display: flex; flex-direction: column; gap: 16px; }

            .step { display: none; }

            .step.active { display: block; }

    

            .blocks-section { display: flex; gap: 16px; margin-top: 8px; }

            .blocks-available { flex: 1; min-width: 0; /* Prevent overflow */ }

            .blocks-selected { flex: 1; min-width: 0; /* Prevent overflow */ }

    

            .category { margin-bottom: 16px; }

            .blocks-grid { display: flex; flex-wrap: wrap; gap: 6px; }

    

            .block {

                display: inline-flex;

                align-items: center;

                gap: 6px;

                padding: 6px 10px;

                background: var(--vscode-badge-background);

                color: var(--vscode-badge-foreground);

                border-radius: 4px;

                font-size: 12px;

                cursor: pointer;

                user-select: none;

                transition: transform 0.1s, box-shadow 0.1s;

            }

            .block:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }

    

            .selected-list {

                min-height: 100px;

                background: var(--vscode-editor-inactiveSelectionBackground);

                border: 2px dashed var(--vscode-panel-border);

                border-radius: 6px;

                padding: 8px;

                display: flex;

                flex-direction: column;

                gap: 4px;

            }

            .selected-list.empty::before {

                content: 'Haz clic en los bloques para agregarlos aquí';

                display: block;

                text-align: center;

                padding: 30px;

                opacity: 0.5;

                font-size: 12px;

            }

    

            .selected-item {

                display: flex;

                align-items: center;

                gap: 8px;

                padding: 8px;

                background: var(--vscode-button-background);

                color: var(--vscode-button-foreground);

                border-radius: 4px;

                font-size: 12px;

            }

            .selected-item .order {

                background: rgba(255,255,255,0.2);

                padding: 2px 6px;

                border-radius: 3px;

                font-weight: bold;

            }

            .selected-item .block-label { flex: 1; word-break: break-all; } /* Break long words */

            .selected-item .block-actions { display: flex; gap: 6px; }

            .selected-item .move-btn, .selected-item .remove {

                cursor: pointer;

                opacity: 0.7;

                padding: 2px 4px;

            }

            .selected-item .move-btn:hover, .selected-item .remove:hover { opacity: 1; }

    

            .canvas-container {

                display: flex;

                flex-direction: column;

                align-items: center;

                gap: 16px;

                width: 100%;

            }

            #drawingCanvas {

                border: 2px solid var(--vscode-panel-border);

                border-radius: 8px;

                cursor: crosshair;

                background: var(--vscode-editor-background);

                max-width: 100%; /* Responsive canvas */

                height: auto;

            }

            .sample-indicators {

                display: flex;

                gap: 12px;

                font-size: 24px;

            }

            .sample-dot { opacity: 0.3; }

            .sample-dot.done { opacity: 1; }

    

            .validation-message {

                display: none;

                padding: 10px 16px;

                border-radius: 4px;

                font-size: 13px;

                max-width: 400px;

                width: 100%;

                text-align: center;

                margin: 8px 0;

            }

            .validation-message.visible { display: block; }

            .validation-message.error {

                background: var(--vscode-inputValidation-errorBackground);

                color: var(--vscode-inputValidation-errorForeground);

                border: 1px solid var(--vscode-inputValidation-errorBorder);

            }

            .validation-message.warning {

                background: var(--vscode-inputValidation-warningBackground);

                color: var(--vscode-inputValidation-warningForeground);

                border: 1px solid var(--vscode-inputValidation-warningBorder);

            }

            .validation-message.success {

                background: var(--vscode-terminal-ansiGreen);

                color: var(--vscode-editor-background);

                border: 1px solid var(--vscode-terminal-ansiBrightGreen);

            }

    

            .nav-buttons { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }

            .hint-text { font-size: 12px; opacity: 0.7; margin-top: 8px; }

            /* Command Search Autocomplete */
            .command-search-container { position: relative; flex: 1; }
            .command-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                max-height: 200px;
                overflow-y: auto;
                background: var(--vscode-dropdown-background);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 0 0 4px 4px;
                z-index: 100;
                display: none;
            }
            .command-dropdown.visible { display: block; }
            .command-option {
                padding: 8px 12px;
                cursor: pointer;
                font-size: 12px;
                border-bottom: 1px solid var(--vscode-widget-border);
            }
            .command-option:hover { background: var(--vscode-list-hoverBackground); }
            .command-option:last-child { border-bottom: none; }
            .command-option .match { background: var(--vscode-editor-findMatchHighlightBackground); font-weight: bold; }
            .command-count { font-size: 11px; opacity: 0.6; margin-top: 4px; }

            .form-row { display: flex; gap: 16px; }

            .form-field { flex: 1; }

            .form-field-small { flex: 0 0 100px; }

    

            /* Mobile/Responsive Adjustments */

            @media (max-width: 600px) {

                .blocks-section {

                    flex-direction: column;

                }

                

                .form-row {

                    flex-direction: column;

                    gap: 8px;

                }

                

                .form-field-small {

                    flex: auto;

                    width: 100%;

                }

    

                .routine-actions {

                    width: 100%;

                    justify-content: flex-end;

                    margin-top: 8px;

                }

                

                .nav-buttons {

                    flex-direction: column;

                }

                

                .nav-buttons button {

                    width: 100%;

                }

    

                #drawingCanvas {

                    width: 100%;

                }

            }

        </style>`;
    }

    private getBodyHTML(): string {
        return `
    <div id="mainView" class="view active">
        <h1>Code Pen - Configurar Rutinas</h1>
        <button id="btnNewRoutine">+ Nueva Rutina</button>
        <div id="routineList" class="routine-list"></div>
    </div>

    <div id="createView" class="view">
        <h1>Crear Nueva Rutina</h1>

        <div id="step1" class="step active">
            <div class="create-container">
                <div class="form-row">
                    <div class="form-field">
                        <h3>Nombre de la Rutina</h3>
                        <input type="text" id="routineName" placeholder="Ej: Modo Focus, Deploy Rápido...">
                    </div>
                    <div class="form-field form-field-small">
                        <h3>Delay (ms)</h3>
                        <input type="number" id="routineDelay" value="0" min="0" max="5000" step="100" placeholder="0">
                    </div>
                </div>

                <!-- Custom Command Input with Search -->
                <div style="margin-bottom: 20px; padding: 15px; background: var(--vscode-editor-background); border-radius: 4px; border: 1px solid var(--vscode-input-border);">
                    <h3 style="margin-top: 0; margin-bottom: 10px;">[+] Comando Personalizado</h3>
                    <div style="display: flex; gap: 10px; align-items: flex-start;">
                        <div class="command-search-container">
                            <input
                                type="text"
                                id="customCommandInput"
                                placeholder="Buscar comando... (ej: save, zen, terminal)"
                                autocomplete="off"
                                style="padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; width: 100%;"
                            />
                            <div id="commandDropdown" class="command-dropdown"></div>
                            <div id="commandCount" class="command-count"></div>
                        </div>
                        <button id="btnAddCustomCommand" style="padding: 8px 16px; cursor: pointer; background: #0e639c; color: white; border: none; border-radius: 3px;">Agregar</button>
                    </div>
                    <div style="margin-top: 8px; font-size: 0.9em; opacity: 0.7;">
                        Escribe para buscar entre todos los comandos de VS Code
                    </div>
                </div>

                <div class="blocks-section">
                    <div class="blocks-available">
                        <h2>Bloques Disponibles</h2>
                        <div id="blocksContainer"></div>
                    </div>
                    <div class="blocks-selected">
                        <h2>Tu Rutina</h2>
                        <div id="selectedBlocks" class="selected-list empty"></div>
                    </div>
                </div>

                <div class="nav-buttons">
                    <button class="secondary" id="btnCancelCreate">Cancelar</button>
                    <button class="secondary" id="btnTestRoutine" disabled>Probar</button>
                    <button id="btnNextStep" disabled>Siguiente: Dibujar Gesto</button>
                </div>
                <div id="step1Hint" class="hint-text"></div>
            </div>
        </div>

        <div id="step2" class="step">
            <div class="canvas-container">
                <h2>Dibuja el gesto para: <span id="gestureRoutineName"></span></h2>
                <p style="opacity: 0.7; margin: 0;">Dibuja el mismo gesto 3 veces. Debe ser diferente de otras rutinas.</p>

                <div class="sample-indicators">
                    <span class="sample-dot" id="dot1">○</span>
                    <span class="sample-dot" id="dot2">○</span>
                    <span class="sample-dot" id="dot3">○</span>
                </div>

                <canvas id="drawingCanvas" width="400" height="300"></canvas>

                <div id="validationMessage" class="validation-message"></div>

                <div class="nav-buttons">
                    <button class="secondary" id="btnBackStep">Atrás</button>
                    <button id="btnSaveRoutine" disabled>Guardar Rutina</button>
                </div>
            </div>
        </div>
    </div>`;
    }

    private getScripts(blocksJson: string, routinesJson: string, commandsJson: string): string {
        // Continue in next part due to length...
        return `<script>${this.getJavaScriptCode(blocksJson, routinesJson, commandsJson)}</script>`;
    }

    private getJavaScriptCode(blocksJson: string, routinesJson: string, commandsJson: string): string {
        // This contains the full JavaScript from the original but with improved validation
        // The key improvement is better validation messages and user feedback
        return `
        const vscode = acquireVsCodeApi();
        const BLOCKS = ${blocksJson};
        let routines = ${routinesJson};
        const ALL_COMMANDS = ${commandsJson};
        let selectedCommands = [];
        let recordedSamples = [];
        const REQUIRED_SAMPLES = 3;
        let editingRoutineName = null;
        let pendingValidation = null;
        let validationRequestId = 0;

        // Función para sanitizar HTML y prevenir XSS
        function escapeHtml(text) {
            if (typeof text !== 'string') return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        const mainView = document.getElementById('mainView');
        const createView = document.getElementById('createView');
        const step1 = document.getElementById('step1');
        const step2 = document.getElementById('step2');
        const routineList = document.getElementById('routineList');
        const blocksContainer = document.getElementById('blocksContainer');
        const selectedBlocksEl = document.getElementById('selectedBlocks');
        const routineNameInput = document.getElementById('routineName');
        const routineDelayInput = document.getElementById('routineDelay');
        const btnNextStep = document.getElementById('btnNextStep');
        const btnTestRoutine = document.getElementById('btnTestRoutine');
        const btnSaveRoutine = document.getElementById('btnSaveRoutine');
        const gestureRoutineName = document.getElementById('gestureRoutineName');
        const step1Hint = document.getElementById('step1Hint');
        const canvas = document.getElementById('drawingCanvas');
        const ctx = canvas.getContext('2d');
        const validationMessage = document.getElementById('validationMessage');
        let painting = false;
        let points = [];

        function getThemeColor(varName, fallback) {
            return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
        }

        renderBlocks();
        renderRoutineList();
        setupCanvas();

        document.getElementById('btnNewRoutine').addEventListener('click', () => {
            showView('create');
            resetCreateForm();
        });

        document.getElementById('btnCancelCreate').addEventListener('click', () => showView('main'));
        document.getElementById('btnBackStep').addEventListener('click', () => showStep(1));

        btnNextStep.addEventListener('click', () => {
            showStep(2);
            gestureRoutineName.textContent = routineNameInput.value;
            recordedSamples = [];
            updateSampleDots();
        });

        btnSaveRoutine.addEventListener('click', () => {
            vscode.postMessage({
                command: 'saveRoutine',
                name: routineNameInput.value,
                commands: selectedCommands.map(b => b.command),
                samples: recordedSamples,
                delay: parseInt(routineDelayInput.value) || 0
            });
            showView('main');
        });

        btnTestRoutine.addEventListener('click', () => {
            vscode.postMessage({
                command: 'testRoutine',
                commands: selectedCommands.map(b => b.command),
                delay: parseInt(routineDelayInput.value) || 0
            });
        });

        routineNameInput.addEventListener('input', validateStep1);

        // Custom command input with search
        const customCommandInput = document.getElementById('customCommandInput');
        const btnAddCustomCommand = document.getElementById('btnAddCustomCommand');
        const commandDropdown = document.getElementById('commandDropdown');
        const commandCount = document.getElementById('commandCount');
        let selectedDropdownIndex = -1;

        function addCustomCommand(cmd) {
            const command = cmd || customCommandInput.value.trim();
            if (command) {
                const customBlock = {
                    id: 'custom-' + Date.now(),
                    label: command,
                    icon: '',
                    command: command,
                    category: 'files'
                };
                selectedCommands.push(customBlock);
                renderSelectedBlocks();
                validateStep1();
                customCommandInput.value = '';
                hideDropdown();
            }
        }

        function searchCommands(query) {
            if (!query || query.length < 2) {
                hideDropdown();
                commandCount.textContent = '';
                return;
            }

            const lowerQuery = query.toLowerCase();
            const matches = ALL_COMMANDS.filter(cmd =>
                cmd.toLowerCase().includes(lowerQuery)
            ).slice(0, 50); // Limitar a 50 resultados

            commandCount.textContent = matches.length + ' comandos encontrados';

            if (matches.length === 0) {
                hideDropdown();
                return;
            }

            commandDropdown.innerHTML = matches.map((cmd, i) => {
                // Resaltar la coincidencia
                const idx = cmd.toLowerCase().indexOf(lowerQuery);
                const before = escapeHtml(cmd.slice(0, idx));
                const match = escapeHtml(cmd.slice(idx, idx + query.length));
                const after = escapeHtml(cmd.slice(idx + query.length));
                return '<div class="command-option" data-cmd="' + escapeHtml(cmd) + '" data-index="' + i + '">' +
                    before + '<span class="match">' + match + '</span>' + after +
                    '</div>';
            }).join('');

            commandDropdown.classList.add('visible');
            selectedDropdownIndex = -1;

            // Añadir listeners a las opciones
            commandDropdown.querySelectorAll('.command-option').forEach(el => {
                el.addEventListener('click', () => {
                    addCustomCommand(el.dataset.cmd);
                });
            });
        }

        function hideDropdown() {
            commandDropdown.classList.remove('visible');
            selectedDropdownIndex = -1;
        }

        function navigateDropdown(direction) {
            const options = commandDropdown.querySelectorAll('.command-option');
            if (options.length === 0) return;

            // Quitar selección anterior
            if (selectedDropdownIndex >= 0 && options[selectedDropdownIndex]) {
                options[selectedDropdownIndex].style.background = '';
            }

            // Nueva selección
            selectedDropdownIndex += direction;
            if (selectedDropdownIndex < 0) selectedDropdownIndex = options.length - 1;
            if (selectedDropdownIndex >= options.length) selectedDropdownIndex = 0;

            // Aplicar selección
            options[selectedDropdownIndex].style.background = 'var(--vscode-list-activeSelectionBackground)';
            options[selectedDropdownIndex].scrollIntoView({ block: 'nearest' });
        }

        btnAddCustomCommand.addEventListener('click', () => addCustomCommand());

        customCommandInput.addEventListener('input', (e) => {
            searchCommands(e.target.value);
        });

        customCommandInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateDropdown(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateDropdown(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const options = commandDropdown.querySelectorAll('.command-option');
                if (selectedDropdownIndex >= 0 && options[selectedDropdownIndex]) {
                    addCustomCommand(options[selectedDropdownIndex].dataset.cmd);
                } else if (customCommandInput.value.trim()) {
                    addCustomCommand();
                }
            } else if (e.key === 'Escape') {
                hideDropdown();
            }
        });

        customCommandInput.addEventListener('blur', () => {
            // Delay para permitir click en opción
            setTimeout(hideDropdown, 200);
        });

        customCommandInput.addEventListener('focus', () => {
            if (customCommandInput.value.length >= 2) {
                searchCommands(customCommandInput.value);
            }
        });

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'routinesUpdated') {
                routines = message.routines;
                renderRoutineList();
            } else if (message.command === 'gestureValidation') {
                handleGestureValidation(message);
            }
        });

        function handleGestureValidation(message) {
            console.log('[handleGestureValidation] Received:', message);
            
            if (!message.isValid) {
                showValidationMessage('error', message.message);
                setTimeout(() => hideValidationMessage(), 3000);
                pendingValidation = null;
                return;
            }
            
            // Aceptado
            if (pendingValidation) {
                recordedSamples.push(pendingValidation);
                pendingValidation = null;
                updateSampleDots();
                
                const current = recordedSamples.length;
                showValidationMessage('success', 'Gesto ' + current + '/3');
                
                if (current >= REQUIRED_SAMPLES) {
                    btnSaveRoutine.disabled = false;
                    showValidationMessage('success', 'COMPLETO! Guarda ahora');
                } else {
                    setTimeout(() => hideValidationMessage(), 1500);
                }
            }
        }

        function showValidationMessage(type, text) {
            validationMessage.className = 'validation-message visible ' + type;
            validationMessage.textContent = text;
        }

        function hideValidationMessage() {
            validationMessage.classList.remove('visible');
        }

        function showView(view) {
            mainView.classList.toggle('active', view === 'main');
            createView.classList.toggle('active', view === 'create');
        }

        function showStep(step) {
            step1.classList.toggle('active', step === 1);
            step2.classList.toggle('active', step === 2);
        }

        function resetCreateForm() {
            routineNameInput.value = '';
            routineDelayInput.value = '0';
            selectedCommands = [];
            recordedSamples = [];
            editingRoutineName = null;
            btnSaveRoutine.disabled = true;
            renderSelectedBlocks();
            validateStep1();
            showStep(1);
        }

        function renderBlocks() {
            const categories = {
                files: { name: 'Archivos', blocks: [] },
                focus: { name: 'Concentración', blocks: [] },
                appearance: { name: 'Apariencia', blocks: [] },
                terminal: { name: 'Terminal', blocks: [] },
                git: { name: 'Git', blocks: [] }
            };

            BLOCKS.forEach(block => categories[block.category].blocks.push(block));

            blocksContainer.innerHTML = Object.entries(categories).map(([key, cat]) =>
                '<div class="category"><h3>' + escapeHtml(cat.name) + '</h3><div class="blocks-grid">' +
                cat.blocks.map(b => '<div class="block" data-id="' + escapeHtml(b.id) + '"><span>' + escapeHtml(b.label) + '</span></div>').join('') +
                '</div></div>'
            ).join('');

            blocksContainer.querySelectorAll('.block').forEach(el => {
                el.addEventListener('click', () => {
                    const block = BLOCKS.find(b => b.id === el.dataset.id);
                    if (block) {
                        selectedCommands.push(block);
                        renderSelectedBlocks();
                        validateStep1();
                    }
                });
            });
        }

        function renderSelectedBlocks() {
            if (selectedCommands.length === 0) {
                selectedBlocksEl.innerHTML = '';
                selectedBlocksEl.classList.add('empty');
            } else {
                selectedBlocksEl.classList.remove('empty');
                selectedBlocksEl.innerHTML = selectedCommands.map((block, i) =>
                    '<div class="selected-item">' +
                    '<span class="order">' + (i + 1) + '</span>' +
                    '<span class="block-label">' + escapeHtml(block.label) + '</span>' +
                    '<span class="block-actions">' +
                    '<span class="move-btn" data-dir="up" data-index="' + i + '"' + (i === 0 ? ' style="visibility:hidden"' : '') + '>↑</span>' +
                    '<span class="move-btn" data-dir="down" data-index="' + i + '"' + (i === selectedCommands.length - 1 ? ' style="visibility:hidden"' : '') + '>↓</span>' +
                    '<span class="remove" data-index="' + i + '">✕</span>' +
                    '</span></div>'
                ).join('');

                selectedBlocksEl.querySelectorAll('.move-btn').forEach(el => {
                    el.addEventListener('click', () => {
                        const idx = parseInt(el.dataset.index);
                        const dir = el.dataset.dir;
                        if (dir === 'up' && idx > 0) {
                            [selectedCommands[idx], selectedCommands[idx - 1]] = [selectedCommands[idx - 1], selectedCommands[idx]];
                        } else if (dir === 'down' && idx < selectedCommands.length - 1) {
                            [selectedCommands[idx], selectedCommands[idx + 1]] = [selectedCommands[idx + 1], selectedCommands[idx]];
                        }
                        renderSelectedBlocks();
                    });
                });

                selectedBlocksEl.querySelectorAll('.remove').forEach(el => {
                    el.addEventListener('click', () => {
                        selectedCommands.splice(parseInt(el.dataset.index), 1);
                        renderSelectedBlocks();
                        validateStep1();
                    });
                });
            }
        }

        function validateStep1() {
            const name = routineNameInput.value.trim();
            const hasName = name.length > 0;
            const hasCommands = selectedCommands.length > 0;
            const isDuplicate = hasName && routines[name] && name !== editingRoutineName;

            btnNextStep.disabled = !(hasName && hasCommands && !isDuplicate);
            btnTestRoutine.disabled = !hasCommands;

            if (!hasName && !hasCommands) {
                step1Hint.textContent = 'Ingresa un nombre y selecciona al menos un bloque';
            } else if (!hasName) {
                step1Hint.textContent = 'Ingresa un nombre para la rutina';
            } else if (isDuplicate) {
                step1Hint.textContent = 'Ya existe una rutina con ese nombre';
            } else if (!hasCommands) {
                step1Hint.textContent = 'Selecciona al menos un bloque';
            } else {
                step1Hint.textContent = 'Listo para continuar →';
            }
        }

        function renderRoutineList() {
            const names = Object.keys(routines);
            if (names.length === 0) {
                routineList.innerHTML = '<div class="empty-state">No hay rutinas creadas.<br>¡Crea tu primera rutina!</div>';
            } else {
                routineList.innerHTML = names.map((name, idx) => {
                    const r = routines[name];
                    const isEnabled = r.enabled !== false;
                    const cmdLabels = r.commands.map(cmd => {
                        const block = BLOCKS.find(b => b.command === cmd);
                        return block ? block.label : cmd;
                    }).join(' → ');

                    return '<div class="routine-card' + (isEnabled ? '' : ' disabled') + '">' +
                        '<canvas class="routine-preview" id="preview-' + idx + '" width="60" height="60"></canvas>' +
                        '<div class="routine-info">' +
                        '<div class="routine-name">' + escapeHtml(r.name) + (isEnabled ? '' : ' (desactivada)') + '</div>' +
                        '<div class="routine-commands">' + escapeHtml(cmdLabels) + '</div>' +
                        '</div>' +
                        '<div class="routine-actions">' +
                        '<button class="secondary" data-toggle="' + escapeHtml(name) + '">' + (isEnabled ? 'Desactivar' : 'Activar') + '</button>' +
                        '<button class="secondary" data-edit="' + escapeHtml(name) + '">Editar</button>' +
                        '<button class="danger" data-delete="' + escapeHtml(name) + '">Eliminar</button>' +
                        '</div></div>';
                }).join('');

                names.forEach((name, idx) => {
                    const r = routines[name];
                    if (r.samples && r.samples.length > 0) {
                        drawGesturePreview('preview-' + idx, r.samples[0]);
                    }
                });

                routineList.querySelectorAll('[data-toggle]').forEach(el => {
                    el.addEventListener('click', () => {
                        vscode.postMessage({ command: 'toggleRoutine', name: el.dataset.toggle });
                    });
                });

                routineList.querySelectorAll('[data-edit]').forEach(el => {
                    el.addEventListener('click', () => editRoutine(el.dataset.edit));
                });

                routineList.querySelectorAll('[data-delete]').forEach(el => {
                    el.addEventListener('click', () => {
                        vscode.postMessage({ command: 'deleteRoutine', name: el.dataset.delete });
                    });
                });
            }
        }

        function editRoutine(name) {
            const r = routines[name];
            if (!r) return;

            editingRoutineName = name;
            routineNameInput.value = r.name;
            routineDelayInput.value = r.delay || 0;
            selectedCommands = r.commands.map(cmd => 
                BLOCKS.find(b => b.command === cmd) || { id: cmd, label: cmd, command: cmd, category: 'files' }
            );
            recordedSamples = r.samples ? r.samples.slice() : [];
            renderSelectedBlocks();
            validateStep1();
            updateSampleDots();
            btnSaveRoutine.disabled = recordedSamples.length < REQUIRED_SAMPLES;
            showView('create');
            showStep(1);
        }

        function drawGesturePreview(canvasId, points) {
            const canvas = document.getElementById(canvasId);
            if (!canvas || !points || points.length < 2) return;

            const ctx = canvas.getContext('2d');
            const padding = 8;
            const size = 60 - padding * 2;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            points.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });

            const width = maxX - minX || 1;
            const height = maxY - minY || 1;
            const scale = Math.min(size / width, size / height);
            const offsetX = padding + (size - width * scale) / 2;
            const offsetY = padding + (size - height * scale) / 2;

            ctx.strokeStyle = getThemeColor('--vscode-editorCursor-foreground', '#888');
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();

            points.forEach((p, i) => {
                const x = (p.x - minX) * scale + offsetX;
                const y = (p.y - minY) * scale + offsetY;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
        }

        function setupCanvas() {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = getThemeColor('--vscode-editorCursor-foreground', '#888');
            ctx.lineWidth = 4;

            canvas.addEventListener('mousedown', startPosition);
            canvas.addEventListener('mouseup', finishedPosition);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseleave', finishedPosition);
        }

        function startPosition(e) {
            painting = true;
            points = [];
            hideValidationMessage();
            draw(e);
        }

        function finishedPosition() {
            if (!painting) return;
            painting = false;
            ctx.beginPath();

            if (points.length > 5) {
                pendingValidation = points.slice();
                validationRequestId++;
                
                const currentRequestId = validationRequestId;
                console.log('[finishedPosition] Sending validation request:', currentRequestId);

                vscode.postMessage({
                    command: 'validateGesture',
                    points: pendingValidation,
                    requestId: currentRequestId,
                    excludeRoutineName: editingRoutineName
                });
                
                showValidationMessage('success', 'Validando...');
                
                // Timeout 3 segundos
                setTimeout(() => {
                    if (pendingValidation) {
                        console.log('[finishedPosition] TIMEOUT for request:', currentRequestId);
                        showValidationMessage('error', 'Error - reintenta');
                        pendingValidation = null;
                        setTimeout(() => hideValidationMessage(), 2000);
                    }
                }, 3000);
            } else {
                showValidationMessage('error', 'Muy corto');
                setTimeout(() => hideValidationMessage(), 2000);
            }

            points = [];
            setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 500);
        }

        function draw(e) {
            if (!painting) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            points.push({x, y});
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        }

        function updateSampleDots() {
            for (let i = 1; i <= 3; i++) {
                const dot = document.getElementById('dot' + i);
                if (recordedSamples.length >= i) {
                    dot.textContent = '●';
                    dot.classList.add('done');
                } else {
                    dot.textContent = '○';
                    dot.classList.remove('done');
                }
            }
        }`;
    }
}
