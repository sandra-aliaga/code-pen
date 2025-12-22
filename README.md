# Code Pen - Gesture-Based Routine Automation for VS Code

Automatiza tus tareas repetitivas en VS Code dibujando gestos personalizados. Code Pen permite crear rutinas mediante gestos de mouse/trackpad que ejecutan secuencias de comandos predefinidos.

## 🚀 Características Principales

### ✏️ Canvas de Ejecución Independiente
- Dibuja gestos en un canvas dedicado (no interfiere con tu código)
- Feedback visual inmediato: ✅ reconocido / ❌ no reconocido
- Estadísticas de uso en tiempo real
- Soporte para mouse, trackpad y touch

### ⚙️ Configuración Intuitiva
- Crea rutinas con bloques de comandos predefinidos
- Arrastra para reordenar comandos
- Configura delays entre comandos
- Preview visual de gestos guardados
- Test de rutinas antes de guardar

### 🛡️ Validación Inteligente
- Detecta automáticamente gestos muy similares
- Previene conflictos entre rutinas
- Mensajes claros de error y sugerencias
- Validación en tiempo real

## 📦 Instalación

1. Clona el repositorio
2. Abre en VS Code
3. Instala dependencias: `npm install`
4. Compila: `npm run compile`
5. Presiona F5 para ejecutar la extensión

## 🎯 Uso Rápido

### Crear una Rutina

1. **Abre el panel de configuración**
   - Presiona `Ctrl+Alt+C` (Mac: `Cmd+Alt+C`)
   - O desde Command Palette: "Code Pen: Configurar Rutinas"

2. **Crea la rutina**
   - Clic en "+ Nueva Rutina"
   - Ingresa un nombre (ej: "Modo Focus")
   - Selecciona bloques de comandos
   - (Opcional) Configura delay entre comandos
   - Presiona "Siguiente: Dibujar Gesto"

3. **Dibuja el gesto**
   - Dibuja el mismo patrón 3 veces
   - El sistema valida que sea único
   - Guarda la rutina

### Ejecutar una Rutina

1. **Abre el canvas de ejecución**
   - Presiona `Ctrl+Alt+A` (Mac: `Cmd+Alt+A`)
   - O desde Command Palette: "Code Pen: Ejecutar Gestos"

2. **Dibuja tu gesto**
   - Dibuja el gesto asociado a tu rutina
   - Verás feedback inmediato
   - La rutina se ejecuta automáticamente

## 🎨 Bloques de Comandos Disponibles

### 📁 Archivos
- Guardar / Guardar Todo
- Formatear Documento
- Cerrar Editor / Cerrar Todo

### 🎯 Concentración
- Modo Zen
- Toggle Sidebar / Panel
- Pantalla Completa
- Toggle Minimap

### 🎭 Apariencia
- Cambiar Tema
- Aumentar/Reducir/Reset Fuente

### 💻 Terminal
- Nueva Terminal
- Toggle Terminal
- Limpiar Terminal

### 🔧 Git
- Commit / Push / Pull
- Stash / Stash Pop

## ⌨️ Atajos de Teclado

| Comando | Windows/Linux | Mac |
|---------|--------------|-----|
| Ejecutar Gestos | `Ctrl+Alt+A` | `Cmd+Alt+A` |
| Configurar Rutinas | `Ctrl+Alt+C` | `Cmd+Alt+C` |

## 🏗️ Arquitectura

El proyecto está organizado en módulos independientes:

```
src/
├── blocks.ts                       # Bloques predefinidos
├── routineManager.ts               # Gestión de rutinas (CRUD + persistencia)
├── gestureValidator.ts             # Validación de similitud de gestos
├── gestureRecognitionEngine.ts     # Motor de reconocimiento y ejecución
├── executionCanvasProvider.ts      # Canvas de ejecución (WebView)
├── configurationWebviewProvider.ts # Panel de configuración (WebView)
├── recognizer.ts                   # Algoritmo $1 Recognizer
└── extension.ts                    # Punto de entrada
```

### Principios de Diseño
- ✅ Separación de responsabilidades
- ✅ Modularidad y bajo acoplamiento
- ✅ Inyección de dependencias
- ✅ Tipado fuerte con TypeScript
- ✅ Documentación completa

## 📖 Documentación Adicional

- [MEJORAS_IMPLEMENTADAS.md](./MEJORAS_IMPLEMENTADAS.md) - Detalles de todas las mejoras
- [GUIA_USO.md](./GUIA_USO.md) - Guía completa de usuario
- [MEJORAS_TECNICAS.md](./MEJORAS_TECNICAS.md) - Documentación técnica original

## 🔧 Desarrollo

### Compilar
```bash
npm run compile
```

### Modo Watch
```bash
npm run watch
```

### Ejecutar Tests
```bash
npm run test
```

### Lint
```bash
npm run lint
```

## 🤝 Contribuir

Las contribuciones son bienvenidas! Algunas ideas:

### Nuevas Funcionalidades
- [ ] Exportar/Importar rutinas
- [ ] Compartir rutinas con el equipo
- [ ] Soporte para más tipos de comandos
- [ ] Gestos multi-touch
- [ ] Análisis de uso y sugerencias

### Mejoras
- [ ] Tests unitarios y de integración
- [ ] Tutoriales interactivos
- [ ] Más bloques predefinidos
- [ ] Temas personalizados para el canvas
- [ ] Sincronización en la nube

## 📝 Licencia

[Incluye tu licencia aquí]

## 🙏 Reconocimientos

- Algoritmo de reconocimiento basado en [$1 Recognizer](https://depts.washington.edu/acelab/proj/dollar/index.html)
- Inspirado en la necesidad de automatizar tareas repetitivas en VS Code

## 📧 Contacto

[Tu información de contacto]

---

**¡Haz tu flujo de trabajo más eficiente con gestos!** ✨
