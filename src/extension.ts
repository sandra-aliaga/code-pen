/**
 * ShDraw - VS Code Extension
 * Gesture-based routine automation for VS Code
 */

import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
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
	console.log('[ShDraw] Activating extension...');

	// Initialize output channel
	outputChannel = vscode.window.createOutputChannel('ShDraw');
	context.subscriptions.push(outputChannel);

	// Initialize managers and engines
	routineManager = new RoutineManager(context);
	recognitionEngine = new GestureRecognitionEngine(routineManager, outputChannel);
	executionCanvas = new ExecutionCanvasProvider(context, recognitionEngine);
	configurationWebview = new ConfigurationWebviewProvider(context, routineManager, outputChannel);

	console.log('[ShDraw] Initialized with', Object.keys(routineManager.getAll()).length, 'routines');

	// Create status bar items
	statusBarExecute = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarExecute.text = `$(pencil) ${l10n.t('Draw')}`;
	statusBarExecute.tooltip = l10n.t('Execute gestures (Ctrl+Alt+D)');
	statusBarExecute.command = 'shdraw.openExecutionCanvas';
	statusBarExecute.show();
	context.subscriptions.push(statusBarExecute);

	statusBarConfig = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
	statusBarConfig.text = `$(gear) ${l10n.t('Routines')}`;
	statusBarConfig.tooltip = l10n.t('Configure routines (Ctrl+Alt+A)');
	statusBarConfig.command = 'shdraw.openConfigPanel';
	statusBarConfig.show();
	context.subscriptions.push(statusBarConfig);

	// Register commands

	// Legacy command - kept for compatibility
	const disposableHello = vscode.commands.registerCommand('shdraw.helloWorld', () => {
		vscode.window.showInformationMessage(l10n.t('ShDraw is active! Use Ctrl+Alt+D to execute gestures or Ctrl+Alt+A to configure routines.'));
	});

	// Open execution canvas
	const disposableExecutionCanvas = vscode.commands.registerCommand('shdraw.openExecutionCanvas', () => {
		executionCanvas.show();
	});

	// Open configuration panel
	const disposableConfigPanel = vscode.commands.registerCommand('shdraw.openConfigPanel', () => {
		configurationWebview.show();
	});

	// Legacy commands mapped to new ones
	const disposableToggle = vscode.commands.registerCommand('shdraw.toggleDrawing', () => {
		executionCanvas.show();
	});

	const disposableCanvas = vscode.commands.registerCommand('shdraw.openCanvas', () => {
		configurationWebview.show();
	});

	context.subscriptions.push(
		disposableHello,
		disposableExecutionCanvas,
		disposableConfigPanel,
		disposableToggle,
		disposableCanvas
	);

	console.log('[ShDraw] Extension activated successfully');
}

/**
 * Extension deactivation
 */
export function deactivate() {
	console.log('[ShDraw] Deactivating extension');
	if (outputChannel) {
		outputChannel.dispose();
	}
}
