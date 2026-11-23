export async function saveJsonBackup(filename, load, feedback, browser = window) {
  // Request the location during the click, before awaiting a network request.
  const handle =
    typeof browser.showSaveFilePicker === 'function'
      ? await browser.showSaveFilePicker({
          id: 'finanzas-backups',
          startIn: 'downloads',
          suggestedName: filename,
          types: [{ description: 'Respaldo JSON', accept: { 'application/json': ['.json'] } }],
        })
      : null;
  const content = JSON.stringify(await load(), null, 2);
  if (handle) {
    const writable = await handle.createWritable();
    try {
      await writable.write(content);
      await writable.close();
    } catch (error) {
      try {
        await writable.abort();
      } catch {
        /* Preserve the original failure. */
      }
      throw error;
    }
    feedback(
      `Copia guardada: ${handle.name}. Ubicación: la carpeta que elegiste en Guardar como. El navegador no permite consultar su ruta completa. Para verla en el explorador, abre esa carpeta.`,
    );
    return;
  }
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  feedback(
    `Descarga solicitada: ${filename}. Abre las descargas del navegador (Ctrl+J en Windows) y pulsa Mostrar en carpeta. Se usa la carpeta configurada en tu navegador, normalmente Descargas. Comprueba que la descarga haya terminado.`,
  );
}
