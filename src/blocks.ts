/**
 * Predefined Blocks
 * Safe commands that users can use to build routines
 */

export interface Block {
    id: string;
    label: string;
    icon: string;
    command: string;
    category: 'files' | 'focus' | 'appearance' | 'terminal' | 'git';
}

export const PREDEFINED_BLOCKS: Block[] = [
    // Files
    { id: 'save', label: 'Guardar', icon: '', command: 'workbench.action.files.save', category: 'files' },
    { id: 'saveAll', label: 'Guardar Todo', icon: '', command: 'workbench.action.files.saveAll', category: 'files' },
    { id: 'format', label: 'Formatear', icon: '', command: 'editor.action.formatDocument', category: 'files' },
    { id: 'closeEditor', label: 'Cerrar Editor', icon: '', command: 'workbench.action.closeActiveEditor', category: 'files' },
    { id: 'closeAll', label: 'Cerrar Todo', icon: '', command: 'workbench.action.closeAllEditors', category: 'files' },

    // Focus
    { id: 'zenMode', label: 'Modo Zen (Toggle)', icon: '', command: 'workbench.action.toggleZenMode', category: 'focus' },
    { id: 'exitZenMode', label: 'Salir Modo Zen', icon: '', command: 'workbench.action.exitZenMode', category: 'focus' },
    { id: 'toggleSidebar', label: 'Toggle Sidebar', icon: '', command: 'workbench.action.toggleSidebarVisibility', category: 'focus' },
    { id: 'togglePanel', label: 'Toggle Panel', icon: '', command: 'workbench.action.togglePanel', category: 'focus' },
    { id: 'fullScreen', label: 'Pantalla Completa', icon: '', command: 'workbench.action.toggleFullScreen', category: 'focus' },
    { id: 'toggleMinimap', label: 'Toggle Minimap', icon: '', command: 'editor.action.toggleMinimap', category: 'focus' },

    // Appearance
    { id: 'changeTheme', label: 'Cambiar Tema', icon: '', command: 'workbench.action.selectTheme', category: 'appearance' },
    { id: 'zoomIn', label: 'Aumentar Fuente', icon: '', command: 'editor.action.fontZoomIn', category: 'appearance' },
    { id: 'zoomOut', label: 'Reducir Fuente', icon: '', command: 'editor.action.fontZoomOut', category: 'appearance' },
    { id: 'zoomReset', label: 'Reset Fuente', icon: '', command: 'editor.action.fontZoomReset', category: 'appearance' },

    // Terminal
    { id: 'newTerminal', label: 'Nueva Terminal', icon: '', command: 'workbench.action.terminal.new', category: 'terminal' },
    { id: 'toggleTerminal', label: 'Toggle Terminal', icon: '', command: 'workbench.action.terminal.toggleTerminal', category: 'terminal' },
    { id: 'clearTerminal', label: 'Limpiar Terminal', icon: '', command: 'workbench.action.terminal.clear', category: 'terminal' },

    // Git
    { id: 'gitCommit', label: 'Git Commit', icon: '', command: 'git.commit', category: 'git' },
    { id: 'gitPush', label: 'Git Push', icon: '', command: 'git.push', category: 'git' },
    { id: 'gitPull', label: 'Git Pull', icon: '', command: 'git.pull', category: 'git' },
    { id: 'gitStash', label: 'Git Stash', icon: '', command: 'git.stash', category: 'git' },
    { id: 'gitStashPop', label: 'Git Stash Pop', icon: '', command: 'git.stashPop', category: 'git' },
];
