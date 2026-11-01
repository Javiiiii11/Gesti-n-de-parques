# 🚀 ParkSite — Extensión de Chrome para Bonos Rápidos

Esta extensión permite guardar formularios de bonos completos directamente desde **ParkSite** mediante abreviaturas (como `/1`, `/2`, etc.) y autocompletar automáticamente los formularios en **bonoparques.es** y parques del grupo al escribir la abreviatura y pulsar espacio.

---

## 📦 Instalación en Google Chrome (Modo Desarrollador)

Solo tienes que instalarla una vez siguiendo estos sencillos pasos:

1. Abre Google Chrome y accede a:
   ```
   chrome://extensions/
   ```
2. En la esquina superior derecha, activa el interruptor **«Modo de desarrollador»**.
3. En la esquina superior izquierda, haz clic en el botón **«Cargar descomprimida»**.
4. Selecciona la carpeta:
   ```
   c:\Users\javie\OneDrive\Escritorio\park-sales-app\chrome-extension
   ```
5. ¡Listo! Verás el icono del rayo ⚡ **ParkSite — Bonos Rápidos** en tu barra de extensiones de Chrome. (Recomendado: haz clic en el icono del puzzle 🧩 y fíjalo 📌 para tenerlo siempre a la vista).

---

## ⚡ Cómo se usa

### 1. En ParkSite:
1. Abre tu aplicación **ParkSite**.
2. En la barra lateral izquierda, entra en **«⚡ Bonos rápidos»**.
3. Rellena los datos del titular del bono (email del gestor, nombre, apellidos, fecha de nacimiento DD/MM/AAAA, documento y facturación).
4. Pulsa el botón **«⚡ Pasar a extensión»**.
5. Asigna una abreviatura (por ejemplo `/1` o `/2`) y pulsa **«Guardar en extensión»**.
   - *Se guardará automáticamente tanto en tu extensión como en tu base de datos de ParkSite.*

### 2. En el formulario de bonos (bonoparques.es):
1. Entra en el formulario oficial de bonos en [bonoparques.es](https://www.bonoparques.es).
2. Haz clic en el primer campo de texto (por ejemplo el email o el nombre).
3. Escribe tu abreviatura:
   ```
   /1
   ```
4. Pulsa la tecla **Espacio** (o Tabulador / Enter).
5. **¡Magia!** La extensión:
   - Elimina el `/1` del campo.
   - Rellena individualmente todos los campos en orden:
     1. Email del gestor
     2. Repetir email
     3. Nombre
     4. Primer apellido
     5. Segundo apellido
     6. Día de nacimiento
     7. Mes de nacimiento
     8. Año de nacimiento
     9. Tipo de documento (DNI, NIE, Pasaporte)
     10. Número de documento
     11. Checkbox de facturación
   - Muestra una notificación flotante arriba a la derecha indicando que la plantilla se ha aplicado.
   - **Nunca envía el formulario automáticamente**: tú tienes siempre el control para revisar y continuar.

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

