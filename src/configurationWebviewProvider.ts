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

    // Terminal para testing
    private testTerminal: vscode.Terminal | undefined;

    private getOrCreateTestTerminal(): vscode.Terminal {
        if (this.testTerminal) {
            const terminals = vscode.window.terminals;
            if (terminals.includes(this.testTerminal)) {
                return this.testTerminal;
            }
        }
        this.testTerminal = vscode.window.createTerminal('Code Pen Test');
        return this.testTerminal;
    }

    /**
     * Handle test routine message
     */
    private async handleTestRoutine(message: any): Promise<void> {
        const delay = message.delay || 0;

        vscode.window.showInformationMessage(`Probando rutina...${delay > 0 ? ` (delay: ${delay}ms)` : ""}`);

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
                vscode.window.showWarningMessage(`Error en: ${label}`);
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
            :root {
                --card-radius: 8px;
                --spacing-xs: 4px;
                --spacing-sm: 8px;
                --spacing-md: 16px;
                --spacing-lg: 24px;
                --transition-fast: 0.15s ease;
                --transition-normal: 0.25s ease;
            }

            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            body {
                background: var(--vscode-editor-background);
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                line-height: 1.5;
                padding: var(--spacing-lg);
                min-height: 100vh;
            }

            /* Typography */
            h1 {
                font-size: 1.5em;
                font-weight: 600;
                margin-bottom: var(--spacing-lg);
                color: var(--vscode-foreground);
                letter-spacing: -0.02em;
            }

            h2 {
                font-size: 1em;
                font-weight: 600;
                margin-bottom: var(--spacing-md);
                color: var(--vscode-foreground);
                opacity: 0.9;
            }

            h3 {
                font-size: 0.75em;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--vscode-descriptionForeground);
                margin-bottom: var(--spacing-sm);
            }

            /* Buttons */
            button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: var(--spacing-xs);
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: var(--spacing-sm) var(--spacing-md);
                font-size: 13px;
                font-weight: 500;
                border-radius: var(--card-radius);
                cursor: pointer;
                transition: all var(--transition-fast);
            }

            button:hover:not(:disabled) {
                background: var(--vscode-button-hoverBackground);
                transform: translateY(-1px);
            }

            button:active:not(:disabled) {
                transform: translateY(0);
            }

            button.secondary {
                background: transparent;
                border: 1px solid var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }

            button.secondary:hover:not(:disabled) {
                background: var(--vscode-button-secondaryBackground);
            }

            button.danger {
                background: transparent;
                border: 1px solid var(--vscode-errorForeground);
                color: var(--vscode-errorForeground);
            }

            button.danger:hover:not(:disabled) {
                background: var(--vscode-errorForeground);
                color: var(--vscode-editor-background);
            }

            button:disabled {
                opacity: 0.4;
                cursor: not-allowed;
                transform: none;
            }

            /* Inputs */
            input[type="text"],
            input[type="number"] {
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                padding: 10px 12px;
                font-size: 13px;
                border-radius: 6px;
                width: 100%;
                transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
            }

            input:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 0 0 2px var(--vscode-focusBorder);
            }

            input::placeholder {
                color: var(--vscode-input-placeholderForeground);
            }

            /* Views */
            .view { display: none; }
            .view.active { display: block; animation: fadeIn 0.2s ease; }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }

            /* Routine List */
            .routine-list {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-sm);
                margin-top: var(--spacing-lg);
            }

            .routine-card {
                background: var(--vscode-editor-inactiveSelectionBackground);
                border: 1px solid var(--vscode-widget-border);
                border-radius: var(--card-radius);
                padding: var(--spacing-md);
                display: flex;
                gap: var(--spacing-md);
                align-items: center;
                flex-wrap: wrap;
                transition: all var(--transition-fast);
            }

            .routine-card:hover {
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }

            .routine-preview {
                width: 56px;
                height: 56px;
                border: 1px solid var(--vscode-widget-border);
                border-radius: 6px;
                background: var(--vscode-editor-background);
                flex-shrink: 0;
            }

            .routine-info {
                flex: 1;
                min-width: 180px;
            }

            .routine-name {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 2px;
            }

            .routine-commands {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 300px;
            }

            .routine-actions {
                display: flex;
                gap: var(--spacing-sm);
                margin-left: auto;
            }

            .routine-actions button {
                padding: 6px 12px;
                font-size: 12px;
            }

            .routine-card.disabled {
                opacity: 0.5;
            }

            .routine-card.disabled .routine-preview {
                filter: grayscale(1);
            }

            /* Empty State */
            .empty-state {
                text-align: center;
                padding: 60px 20px;
                color: var(--vscode-descriptionForeground);
            }

            .empty-state::before {
                content: '';
                display: block;
                width: 64px;
                height: 64px;
                margin: 0 auto 16px;
                background: var(--vscode-widget-border);
                border-radius: 50%;
                opacity: 0.3;
            }

            /* Create Container */
            .create-container {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-lg);
            }

            .step { display: none; }
            .step.active { display: block; animation: fadeIn 0.2s ease; }

            /* Form Layout */
            .form-row {
                display: flex;
                gap: var(--spacing-md);
            }

            .form-field { flex: 1; }
            .form-field-small { flex: 0 0 120px; }

            /* Custom Input Boxes */
            .custom-inputs-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: var(--spacing-sm);
            }

            .custom-input-box {
                padding: var(--spacing-md);
                background: var(--vscode-sideBar-background);
                border: 1px solid var(--vscode-widget-border);
                border-radius: var(--card-radius);
                transition: border-color var(--transition-fast);
            }

            .custom-input-box:hover {
                border-color: var(--vscode-focusBorder);
            }

            .custom-input-box h3 {
                text-transform: none;
                font-size: 11px;
                margin-bottom: var(--spacing-sm);
            }

            .custom-input-box .input-row {
                display: flex;
                gap: var(--spacing-sm);
            }

            .custom-input-box input {
                flex: 1;
                padding: 8px 10px;
                font-size: 12px;
            }

            .custom-input-box button {
                padding: 8px 14px;
                font-size: 12px;
                min-width: 40px;
            }

            /* Terminal Style */
            .terminal-box {
                border-color: var(--vscode-terminal-ansiCyan);
                border-left-width: 3px;
            }
            .terminal-box h3 { color: var(--vscode-terminal-ansiCyan); }
            .terminal-btn {
                background: var(--vscode-terminal-ansiCyan) !important;
                color: var(--vscode-editor-background) !important;
            }

            /* Delay Style */
            .delay-box {
                border-color: var(--vscode-terminal-ansiYellow);
                border-left-width: 3px;
            }
            .delay-box h3 { color: var(--vscode-terminal-ansiYellow); }
            .delay-btn {
                background: var(--vscode-terminal-ansiYellow) !important;
                color: var(--vscode-editor-background) !important;
            }

            /* Blocks Section */
            .blocks-section {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: var(--spacing-lg);
                margin-top: var(--spacing-md);
            }

            .category {
                margin-bottom: var(--spacing-md);
            }

            .blocks-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }

            .block {
                display: inline-flex;
                align-items: center;
                padding: 6px 12px;
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                user-select: none;
                transition: all var(--transition-fast);
                border: 1px solid transparent;
            }

            .block:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            .block.terminal-type {
                border-left: 3px solid var(--vscode-terminal-ansiCyan);
            }

            .block.delay-type {
                border-left: 3px solid var(--vscode-terminal-ansiYellow);
            }

            /* Selected List */
            .selected-list {
                min-height: 120px;
                background: var(--vscode-sideBar-background);
                border: 2px dashed var(--vscode-widget-border);
                border-radius: var(--card-radius);
                padding: var(--spacing-sm);
                display: flex;
                flex-direction: column;
                gap: var(--spacing-xs);
                transition: border-color var(--transition-fast);
            }

            .selected-list:hover {
                border-color: var(--vscode-focusBorder);
            }

            .selected-list.empty::before {
                content: 'Haz clic en los bloques para agregarlos';
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                min-height: 100px;
                color: var(--vscode-descriptionForeground);
                font-size: 12px;
            }

            .selected-item {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                padding: 10px 12px;
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                border-radius: 6px;
                font-size: 12px;
                transition: all var(--transition-fast);
            }

            .selected-item:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .selected-item .order {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                border-radius: 50%;
                font-size: 11px;
                font-weight: 600;
                flex-shrink: 0;
            }

            .selected-item .block-label {
                flex: 1;
                font-weight: 500;
            }

            .selected-item .block-actions {
                display: flex;
                gap: 4px;
                opacity: 0;
                transition: opacity var(--transition-fast);
            }

            .selected-item:hover .block-actions {
                opacity: 1;
            }

            .selected-item .move-btn,
            .selected-item .remove {
                cursor: pointer;
                padding: 4px 6px;
                border-radius: 4px;
                transition: background var(--transition-fast);
            }

            .selected-item .move-btn:hover,
            .selected-item .remove:hover {
                background: var(--vscode-toolbar-hoverBackground);
            }

            .selected-item.terminal-type {
                border-left: 3px solid var(--vscode-terminal-ansiCyan);
            }

            .selected-item.delay-type {
                border-left: 3px solid var(--vscode-terminal-ansiYellow);
            }

            /* Canvas Container */
            .canvas-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--spacing-lg);
                padding: var(--spacing-lg);
                background: var(--vscode-sideBar-background);
                border-radius: var(--card-radius);
            }

            .canvas-container h2 {
                margin: 0;
            }

            .canvas-container p {
                color: var(--vscode-descriptionForeground);
                font-size: 13px;
                margin: 0;
            }

            #drawingCanvas {
                border: 2px solid var(--vscode-widget-border);
                border-radius: var(--card-radius);
                cursor: crosshair;
                background: var(--vscode-editor-background);
                transition: border-color var(--transition-fast);
            }

            #drawingCanvas:hover {
                border-color: var(--vscode-focusBorder);
            }

            .sample-indicators {
                display: flex;
                gap: var(--spacing-md);
            }

            .sample-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: var(--vscode-widget-border);
                transition: all var(--transition-normal);
            }

            .sample-dot.done {
                background: var(--vscode-terminal-ansiGreen);
                box-shadow: 0 0 8px var(--vscode-terminal-ansiGreen);
            }

            /* Validation Message */
            .validation-message {
                display: none;
                padding: 12px 20px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                max-width: 400px;
                text-align: center;
            }

            .validation-message.visible {
                display: block;
                animation: fadeIn 0.2s ease;
            }

            .validation-message.error {
                background: var(--vscode-inputValidation-errorBackground);
                border: 1px solid var(--vscode-inputValidation-errorBorder);
                color: var(--vscode-errorForeground);
            }

            .validation-message.success {
                background: var(--vscode-inputValidation-infoBackground);
                border: 1px solid var(--vscode-inputValidation-infoBorder);
                color: var(--vscode-foreground);
            }

            /* Navigation */
            .nav-buttons {
                display: flex;
                gap: var(--spacing-sm);
                margin-top: var(--spacing-lg);
                padding-top: var(--spacing-lg);
                border-top: 1px solid var(--vscode-widget-border);
            }

            .hint-text {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                margin-top: var(--spacing-sm);
            }

            /* Command Dropdown */
            .command-search-container {
                position: relative;
                flex: 1;
            }

            .command-dropdown {
                position: absolute;
                top: calc(100% + 4px);
                left: 0;
                right: 0;
                max-height: 240px;
                overflow-y: auto;
                background: var(--vscode-dropdown-background);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 6px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                z-index: 100;
                display: none;
            }

            .command-dropdown.visible {
                display: block;
                animation: fadeIn 0.15s ease;
            }

            .command-option {
                padding: 10px 12px;
                cursor: pointer;
                font-size: 12px;
                border-bottom: 1px solid var(--vscode-widget-border);
                transition: background var(--transition-fast);
            }

            .command-option:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .command-option:last-child {
                border-bottom: none;
            }

            .command-option .match {
                background: var(--vscode-editor-findMatchHighlightBackground);
                font-weight: 600;
                padding: 1px 2px;
                border-radius: 2px;
            }

            .command-count {
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
                margin-top: var(--spacing-xs);
            }

            /* Responsive */
            @media (max-width: 600px) {
                body { padding: var(--spacing-md); }

                .blocks-section { grid-template-columns: 1fr; }
                .form-row { flex-direction: column; }
                .form-field-small { flex: auto; }
                .routine-actions { width: 100%; margin-top: var(--spacing-sm); }
                .nav-buttons { flex-direction: column; }
                .nav-buttons button { width: 100%; }
                .custom-inputs-grid { grid-template-columns: 1fr; }
            }
        </style>`;
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
                commands: selectedCommands.map(b => ({
                    command: b.command,
                    type: b.type || 'vscode-command',
                    label: b.label
                })),
                samples: recordedSamples,
                delay: parseInt(routineDelayInput.value) || 0
            });
            showView('main');
        });

        btnTestRoutine.addEventListener('click', () => {
            vscode.postMessage({
                command: 'testRoutine',
                commands: selectedCommands.map(b => ({
                    command: b.command,
                    type: b.type || 'vscode-command',
                    label: b.label
                })),
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
                selectedCommands.push({
                    id: 'custom-' + Date.now(),
                    label: command,
                    command: command,
                    type: 'vscode-command'
                });
                renderSelectedBlocks();
                validateStep1();
                customCommandInput.value = '';
                hideDropdown();
            }
        }

        // Terminal command input
        const terminalCommandInput = document.getElementById('terminalCommandInput');
        const btnAddTerminalCommand = document.getElementById('btnAddTerminalCommand');

        function addTerminalCommand() {
            const command = terminalCommandInput.value.trim();
            if (command) {
                selectedCommands.push({
                    id: 'term-' + Date.now(),
                    label: command,
                    command: command,
                    type: 'terminal-command'
                });
                renderSelectedBlocks();
                validateStep1();
                terminalCommandInput.value = '';
            }
        }

        btnAddTerminalCommand.addEventListener('click', addTerminalCommand);
        terminalCommandInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTerminalCommand();
            }
        });

        // Delay input
        const delayInput = document.getElementById('delayInput');
        const btnAddDelay = document.getElementById('btnAddDelay');

        function addDelay() {
            const delayMs = parseInt(delayInput.value) || 0;
            if (delayMs > 0) {
                const label = delayMs >= 1000 ? (delayMs / 1000) + 's' : delayMs + 'ms';
                selectedCommands.push({
                    id: 'delay-' + Date.now(),
                    label: 'Delay ' + label,
                    command: String(delayMs),
                    type: 'delay'
                });
                renderSelectedBlocks();
                validateStep1();
                delayInput.value = '';
            }
        }

        btnAddDelay.addEventListener('click', addDelay);
        delayInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addDelay();
            }
        });

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
                git: { name: 'Git', blocks: [] },
                utils: { name: 'Utilidades', blocks: [] }
            };

            BLOCKS.forEach(block => {
                if (categories[block.category]) {
                    categories[block.category].blocks.push(block);
                }
            });

            blocksContainer.innerHTML = Object.entries(categories)
                .filter(([key, cat]) => cat.blocks.length > 0)
                .map(([key, cat]) =>
                    '<div class="category"><h3>' + escapeHtml(cat.name) + '</h3><div class="blocks-grid">' +
                    cat.blocks.map(b => {
                        const typeClass = b.type === 'terminal-command' ? ' terminal-type' :
                                         b.type === 'delay' ? ' delay-type' : '';
                        return '<div class="block' + typeClass + '" data-id="' + escapeHtml(b.id) + '"><span>' + escapeHtml(b.label) + '</span></div>';
                    }).join('') +
                    '</div></div>'
                ).join('');

            blocksContainer.querySelectorAll('.block').forEach(el => {
                el.addEventListener('click', () => {
                    const block = BLOCKS.find(b => b.id === el.dataset.id);
                    if (block) {
                        selectedCommands.push({
                            id: block.id,
                            label: block.label,
                            command: block.command,
                            type: block.type || 'vscode-command'
                        });
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
                selectedBlocksEl.innerHTML = selectedCommands.map((block, i) => {
                    const type = block.type || 'vscode-command';
                    const typeClass = type === 'terminal-command' ? ' terminal-type' :
                                     type === 'delay' ? ' delay-type' : '';
                    const typeLabel = type === 'terminal-command' ? '[T] ' :
                                     type === 'delay' ? '[D] ' : '';
                    return '<div class="selected-item' + typeClass + '">' +
                        '<span class="order">' + (i + 1) + '</span>' +
                        '<span class="block-label">' + typeLabel + escapeHtml(block.label) + '</span>' +
                        '<span class="block-actions">' +
                        '<span class="move-btn" data-dir="up" data-index="' + i + '"' + (i === 0 ? ' style="visibility:hidden"' : '') + '>↑</span>' +
                        '<span class="move-btn" data-dir="down" data-index="' + i + '"' + (i === selectedCommands.length - 1 ? ' style="visibility:hidden"' : '') + '>↓</span>' +
                        '<span class="remove" data-index="' + i + '">✕</span>' +
                        '</span></div>';
                }).join('');

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
                        // Compatibilidad: si es string (formato antiguo)
                        if (typeof cmd === 'string') {
                            const block = BLOCKS.find(b => b.command === cmd);
                            return block ? block.label : cmd;
                        }
                        // Formato nuevo: objeto con label
                        return cmd.label || cmd.command;
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

            // Cargar comandos con compatibilidad hacia atrás
            selectedCommands = r.commands.map(cmd => {
                // Si es string (formato antiguo), buscar en bloques o crear objeto
                if (typeof cmd === 'string') {
                    const block = BLOCKS.find(b => b.command === cmd);
                    return block ? {
                        id: block.id,
                        label: block.label,
                        command: block.command,
                        type: block.type || 'vscode-command'
                    } : {
                        id: cmd,
                        label: cmd,
                        command: cmd,
                        type: 'vscode-command'
                    };
                }
                // Si ya es objeto (formato nuevo)
                return {
                    id: cmd.command,
                    label: cmd.label || cmd.command,
                    command: cmd.command,
                    type: cmd.type || 'vscode-command'
                };
            });

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
                    dot.classList.add('done');
                } else {
                    dot.classList.remove('done');
                }
            }
        }`;
    }
}
