(() => {
  const term = window.term;
  if (!term?.buffer?.active) {
    return {
      ok: false,
      error: "xterm.js terminal not found at window.term",
      title: document.title,
      url: location.href,
    };
  }
  const buffer = term.buffer.active;
  const rows = term.rows || 0;
  const cols = term.cols || 0;
  const viewportStart = Number.isFinite(buffer.viewportY) ? buffer.viewportY : buffer.baseY || 0;
  const lines = Array.from({ length: rows }, (_, row) => {
    const line = buffer.getLine(viewportStart + row);
    return line?.translateToString(true) || "";
  });
  return {
    ok: true,
    title: document.title,
    url: location.href,
    cols,
    rows,
    viewportStart,
    baseY: buffer.baseY,
    cursor: { x: buffer.cursorX, y: buffer.cursorY, absoluteY: buffer.baseY + buffer.cursorY },
    nonEmptyRows: lines.filter((line) => line.trim()).length,
    text: lines.join("\n"),
  };
})();
