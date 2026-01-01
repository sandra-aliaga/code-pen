# ShDraw - Automatizacion de Rutinas Basada en Gestos para VS Code

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/YOUR_PUBLISHER.shdraw)](https://marketplace.visualstudio.com/items?itemName=YOUR_PUBLISHER.shdraw)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**ShDraw** transforma la forma en que interactuas con VS Code permitiendote **dibujar gestos personalizados** para ejecutar potentes rutinas de automatizacion. Deja de memorizar atajos de teclado complejos — simplemente dibuja una forma y observa como tu flujo de trabajo se ejecuta automaticamente.

> *"Dibuja una 'L' para guardar, formatear y ejecutar tests. Dibuja un circulo para entrar en Modo Zen. Tus gestos, tus reglas."*

![ShDraw Demo](images/demo.gif)

---

## Por que ShDraw?

- **Intuitivo**: Dibujar gestos es mas natural que recordar atajos de teclado
- **Potente**: Encadena multiples comandos en un solo gesto
- **Rapido**: Ejecuta flujos de trabajo complejos en menos de un segundo
- **Personalizable**: Crea rutinas ilimitadas adaptadas a tu flujo de trabajo
- **No intrusivo**: Canvas dedicado que no interfiere con tu codigo

---

## Caracteristicas

### Canvas de Ejecucion
Abre un canvas de dibujo dedicado donde puedes ejecutar tus gestos sin afectar tu editor de codigo.

- Reconocimiento de gestos en tiempo real con feedback visual
- Seguimiento de estadisticas (gestos dibujados vs. reconocidos)
- Soporte para mouse, trackpad y entrada tactil

![Canvas de Ejecucion](images/execution-canvas.png)

### Configuracion de Rutinas
Crea potentes rutinas de automatizacion con una interfaz visual intuitiva.

- **Bloques de comandos predefinidos**: Acciones comunes de VS Code listas para usar
- **Comandos personalizados de VS Code**: Accede a cualquier comando de la paleta de comandos
- **Comandos de terminal**: Ejecuta comandos de shell (npm, git, docker, etc.)
- **Delays configurables**: Agrega tiempos de espera entre comandos
- **Reordenamiento con drag & drop**: Organiza tu secuencia de comandos facilmente
- **Prueba antes de guardar**: Prueba tu rutina antes de confirmar

![Panel de Configuracion](images/configuration-panel.png)

### Validacion Inteligente de Gestos
ShDraw usa el [algoritmo $1 Recognizer](https://depts.washington.edu/acelab/proj/dollar/index.html) para asegurar una deteccion confiable de gestos.

- Deteccion automatica de gestos similares para prevenir conflictos
- Dibuja el mismo gesto 3 veces para registrarlo (asegura consistencia)
- Umbral de reconocimiento del 80% para coincidencia precisa

---

## Instalacion

### Desde VS Code Marketplace
1. Abre VS Code
2. Ve a Extensiones (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Busca "ShDraw"
4. Haz clic en **Instalar**

### Desde VSIX
1. Descarga el archivo `.vsix` desde [Releases](https://github.com/YOUR_USERNAME/shdraw/releases)
2. En VS Code, ve a Extensiones
3. Haz clic en el menu `...` → "Instalar desde VSIX..."
4. Selecciona el archivo descargado

---

## Inicio Rapido

### Paso 1: Crear una Rutina

1. Abre el panel de configuracion:
   - Presiona `Ctrl+Alt+A` (Windows/Linux) o `Cmd+Alt+A` (Mac)
   - O ejecuta el comando: `ShDraw: Configurar Rutinas`

2. Haz clic en **"Nueva Rutina"**

3. Configura tu rutina:
   - Ingresa un nombre (ej: "Modo Focus")
   - Agrega comandos desde los bloques predefinidos o busca cualquier comando de VS Code
   - Opcionalmente agrega comandos de terminal o delays
   - Haz clic en **"Siguiente"**

4. Dibuja tu gesto:
   - Dibuja el mismo patron **3 veces** para registrarlo
   - El sistema valida que sea unico
   - Haz clic en **"Guardar"**

### Paso 2: Ejecutar tu Rutina

1. Abre el canvas de ejecucion:
   - Presiona `Ctrl+Alt+D` (Windows/Linux) o `Cmd+Alt+D` (Mac)
   - O ejecuta el comando: `ShDraw: Ejecutar Gestos`

2. Dibuja tu gesto en el canvas

3. Observa como tu rutina se ejecuta automaticamente!

---

## Bloques de Comandos Disponibles

### Archivos
| Comando | Descripcion |
|---------|-------------|
| Guardar | Guarda el archivo actual |
| Guardar Todo | Guarda todos los archivos abiertos |
| Formatear Documento | Formatea el archivo actual |
| Cerrar Editor | Cierra la pestana actual |
| Cerrar Todo | Cierra todas las pestanas |

### Concentracion
| Comando | Descripcion |
|---------|-------------|
| Modo Zen | Alterna el modo sin distracciones |
| Alternar Sidebar | Muestra/oculta la barra lateral |
| Alternar Panel | Muestra/oculta el panel inferior |
| Pantalla Completa | Alterna pantalla completa |
| Alternar Minimap | Muestra/oculta el minimapa |

### Apariencia
| Comando | Descripcion |
|---------|-------------|
| Cambiar Tema | Abre el selector de temas |
| Aumentar Fuente | Agranda el texto |
| Reducir Fuente | Reduce el texto |
| Resetear Fuente | Restaura el tamano por defecto |

### Terminal
| Comando | Descripcion |
|---------|-------------|
| Nueva Terminal | Abre una nueva terminal |
| Alternar Terminal | Muestra/oculta la terminal |
| Limpiar Terminal | Limpia la salida de la terminal |
| *Comandos personalizados* | Ejecuta cualquier comando de shell |

### Git
| Comando | Descripcion |
|---------|-------------|
| Commit | Abre el dialogo de commit |
| Push | Envia cambios al remoto |
| Pull | Obtiene cambios del remoto |
| Stash | Guarda cambios temporalmente |
| Stash Pop | Aplica cambios guardados |

### Utilidades
| Comando | Descripcion |
|---------|-------------|
| Delay | Espera N milisegundos |
| *Cualquier comando de VS Code* | Busca y agrega cualquier comando |

---

## Atajos de Teclado

| Accion | Windows/Linux | Mac |
|--------|---------------|-----|
| Ejecutar Gestos | `Ctrl+Alt+D` | `Cmd+Alt+D` |
| Configurar Rutinas | `Ctrl+Alt+A` | `Cmd+Alt+A` |

---

## Ejemplos de Rutinas

### "Guardado Rapido y Formato"
1. Guardar archivo
2. Formatear documento

*Gesto sugerido: Palomita (check)*

### "Modo Focus"
1. Alternar Modo Zen
2. Ocultar Sidebar
3. Ocultar Panel

*Gesto sugerido: Circulo*

### "Deploy"
1. Guardar Todo
2. Terminal: `npm run build`
3. Delay: 2000ms
4. Terminal: `npm run deploy`

*Gesto sugerido: Flecha hacia arriba*

### "Flujo de Git Commit"
1. Guardar Todo
2. Git: Stage All
3. Git: Commit

*Gesto sugerido: Letra "G"*

---

## Configuracion de la Extension

Esta extension contribuye los siguientes comandos:

* `shdraw.openExecutionCanvas`: Abre el canvas de ejecucion de gestos
* `shdraw.openConfigPanel`: Abre el panel de configuracion de rutinas

---

## Problemas Conocidos

- Gestos con muy pocos puntos (menos de 5) pueden no ser reconocidos
- Gestos muy similares pueden causar conflictos de reconocimiento (usa el sistema de validacion)
- El canvas requiere entrada de mouse/trackpad (gestos por teclado no soportados)

---

## Notas de la Version

### 0.0.1 - Version Inicial
- Automatizacion de rutinas basada en gestos
- Canvas de ejecucion para dibujar gestos
- Panel de configuracion para crear rutinas
- Soporte para comandos de VS Code, comandos de terminal y delays
- Algoritmo $1 Recognizer para reconocimiento de gestos
- Soporte de internacionalizacion (Ingles, Espanol)

Ver [CHANGELOG.md](CHANGELOG.md) para el historial completo de versiones.

---

## Contribuir

Las contribuciones son bienvenidas! Aqui hay algunas formas en que puedes ayudar:

### Ideas de Funcionalidades
- [ ] Exportar/Importar rutinas
- [ ] Compartir rutinas con miembros del equipo
- [ ] Soporte para gestos multi-touch
- [ ] Analiticas de uso y sugerencias
- [ ] Sincronizacion en la nube para rutinas

### Desarrollo
```bash
# Clonar el repositorio
git clone https://github.com/YOUR_USERNAME/shdraw.git

# Instalar dependencias
npm install

# Compilar
npm run compile

# Modo watch
npm run watch

# Ejecutar tests
npm run test

# Lint
npm run lint
```

---

## Reconocimientos

- Reconocimiento de gestos impulsado por el algoritmo [$1 Recognizer](https://depts.washington.edu/acelab/proj/dollar/index.html) de la Universidad de Washington
- Inspirado por la necesidad de automatizar tareas repetitivas en VS Code

---

## Licencia

Este proyecto esta licenciado bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para mas detalles.

---

## Soporte

- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/shdraw/issues)
- **Discusiones**: [GitHub Discussions](https://github.com/YOUR_USERNAME/shdraw/discussions)

---

<p align="center">
  <strong>Haz tu flujo de trabajo mas eficiente con gestos!</strong><br>
  Si encuentras ShDraw util, por favor considera darle una estrella en GitHub!
</p>
