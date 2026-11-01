# 🚀 ParkSite — Extensión de Chrome para Bonos Rápidos

Esta extensión permite guardar formularios de bonos completos directamente desde **ParkSite** mediante abreviaturas (como `/1`, `/2`, etc.) y autocompletar automáticamente los formularios en **bonoparques.es** y parques del grupo al escribir la abreviatura y pulsar espacio.

---

## 📦 Instalación o Actualización en Google Chrome

1. Abre Google Chrome y accede a:
   ```
   chrome://extensions/
   ```
2. Si ya la tenías cargada, simplemente haz clic en el icono de **Recargar (flecha circular 🔄)** en la tarjeta de **ParkSite — Bonos Rápidos**.
3. Si la vas a cargar por primera vez:
   - Activa el interruptor **«Modo de desarrollador»** (arriba a la derecha).
   - Haz clic en **«Cargar descomprimida»** (arriba a la izquierda).
   - Selecciona la carpeta:
     ```
     c:\Users\javie\OneDrive\Escritorio\park-sales-app\chrome-extension
     ```
4. ¡Listo! Fija el icono del rayo ⚡ en la barra de extensiones.

---

## ⚡ Formulario Simplificado y Rápido

### 1. En ParkSite:
1. En la barra lateral izquierda, entra en **«⚡ Bonos rápidos»**.
2. Rellena los datos esenciales:
   - **Email del gestor** *(1 solo campo: se autocompleta automáticamente tanto en el email como en el repetir email de bonoparques)*.
   - **Nombre**
   - **Primer apellido** *(mejorado con detección multicapa y posicional para rellenarse siempre al 100%)*.
   - **Segundo apellido**
   - **Fecha de nacimiento** (Día, Mes, Año).
   - **Documento** (DNI / NIF / Pasaporte).
3. Pulsa el botón **«⚡ Pasar a extensión»**.
4. Asigna tu abreviatura (ej. `/1`, `/2`) y pulsa **«Guardar en extensión»**.

### 2. En el formulario de bonos (bonoparques.es):
1. Entra en el formulario de bonos en [bonoparques.es](https://www.bonoparques.es).
2. Haz clic en el primer campo de texto (por ejemplo el nombre o el email).
3. Escribe tu abreviatura:
   ```
   /1
   ```
4. Pulsa la tecla **Espacio** (o Tabulador / Enter según tu configuración).
5. **Autocompletado instantáneo**:
   - Borra el `/1` del campo.
   - Rellena automáticamente:
     1. Email del gestor
     2. Repetir email (con el mismo correo)
     3. Nombre
     4. **Primer apellido** (localizado con máxima precisión)
     5. Segundo apellido
     6. Día de nacimiento
     7. Mes de nacimiento
     8. Año de nacimiento
     9. Documento (DNI/NIF/Pasaporte)
   - Muestra el badge verde de éxito en la esquina superior derecha.
   - **Nunca envía el formulario**: el control de revisar y confirmar queda siempre en tus manos.

---

## ⚙️ Opciones del Popup de la extensión

Al hacer clic en el icono ⚡ de la extensión en Chrome puedes:
- **Activar / Pausar** el autocompletado en cualquier momento.
- Cambiar la tecla disparadora (**Espacio**, **Tabulador**, **Enter** o **Al escribir**).
- Ver la lista de todas tus abreviaturas guardadas (`/1`, `/2`...).
- Ver el detalle de los datos de cada titular.
- Copiar la abreviatura al portapapeles con un clic.
- Eliminar abreviaturas que ya no utilices.
- Abrir ParkSite directamente con el botón **«🌐 Abrir ParkSite»**.
