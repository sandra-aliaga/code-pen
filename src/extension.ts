/**
 * Code Pen - VS Code Extension
 * Gesture-based routine automation for VS Code
 */

import * as vscode from 'vscode';
import { RoutineManager } from './routineManager';
import { GestureRecognitionEngine } from './gestureRecognitionEngine';
import { ExecutionCanvasProvider } from './executionCanvasProvider';
import { ConfigurationWebviewProvider } from './configurationWebviewProvider';

// Global instances
let routineManager: RoutineManager;
let recognitionEngine: GestureRecognitionEngine;
let executionCanvas: ExecutionCanvasProvider;
let configurationWebview: ConfigurationWebviewProvider;
let outputChannel: vscode.OutputChannel;
let statusBarExecute: vscode.StatusBarItem;
let statusBarConfig: vscode.StatusBarItem;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('[Code Pen] Activating extension...');

	// Initialize output channel
	outputChannel = vscode.window.createOutputChannel('Code Pen');
	context.subscriptions.push(outputChannel);

	// Initialize managers and engines
	routineManager = new RoutineManager(context);
	recognitionEngine = new GestureRecognitionEngine(routineManager, outputChannel);
	executionCanvas = new ExecutionCanvasProvider(context, recognitionEngine);
	configurationWebview = new ConfigurationWebviewProvider(context, routineManager, outputChannel);

	console.log('[Code Pen] Initialized with', Object.keys(routineManager.getAll()).length, 'routines');

	// Create status bar items
	statusBarExecute = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarExecute.text = "$(pencil) Dibujar";
	statusBarExecute.tooltip = "Ejecutar gestos (Ctrl+Alt+D)";
	statusBarExecute.command = 'code-pen.openExecutionCanvas';
	statusBarExecute.show();
	context.subscriptions.push(statusBarExecute);

	statusBarConfig = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
	statusBarConfig.text = "$(gear) Rutinas";
	statusBarConfig.tooltip = "Configurar rutinas (Ctrl+Alt+A)";
	statusBarConfig.command = 'code-pen.openConfigPanel';
	statusBarConfig.show();
	context.subscriptions.push(statusBarConfig);

	// Register commands
	
	// Legacy command - kept for compatibility
	const disposableHello = vscode.commands.registerCommand('code-pen.helloWorld', () => {
		vscode.window.showInformationMessage('Code Pen está activo! Usa Ctrl+Alt+A para ejecutar gestos o Ctrl+Alt+C para configurar rutinas.');
	});

	// Open execution canvas
	const disposableExecutionCanvas = vscode.commands.registerCommand('code-pen.openExecutionCanvas', () => {
		executionCanvas.show();
	});

	// Open configuration panel
	const disposableConfigPanel = vscode.commands.registerCommand('code-pen.openConfigPanel', () => {
		configurationWebview.show();
	});

	// Legacy commands mapped to new ones
	const disposableToggle = vscode.commands.registerCommand('code-pen.toggleDrawing', () => {
		executionCanvas.show();
	});

	const disposableCanvas = vscode.commands.registerCommand('code-pen.openCanvas', () => {
		configurationWebview.show();
	});

	context.subscriptions.push(
		disposableHello,
		disposableExecutionCanvas,
		disposableConfigPanel,
		disposableToggle,
		disposableCanvas
	);

	console.log('[Code Pen] Extension activated successfully');
}

/**
 * Extension deactivation
 */
export function deactivate() {
	console.log('[Code Pen] Deactivating extension');
	if (outputChannel) {
		outputChannel.dispose();
	}
}
