import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Emit proposed source changes; the caller applies them through apply_patch.
const changes = [];
function visitFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) visitFiles(filename);
    else if (filename.endsWith('.tsx')) transform(filename);
  }
}
function transform(filename) {
  if (process.argv[2] === '--file' && filename !== process.argv[3]) return;
  const source = fs.readFileSync(filename, 'utf8');
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const opening = node => ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
  const attribute = (node, name) => node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.text === name);
  const classText = node => attribute(node, 'className')?.initializer?.getText(file) ?? '';
  function visit(node) {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement;
      const name = tag.tagName.getText(file);
      const children = node.children.map(opening).filter(Boolean);
      const controls = children.filter(child => ['input', 'select'].includes(child.tagName.getText(file)) || classText(child).includes('ai-secret-input'));
      const eligible = (name === 'label' || name === 'div' && classText(tag).includes('detail-field')) &&
        !classText(tag).includes('gradebook-weight-field') && !classText(tag).includes('compact-field') &&
        !children.some(child => child.tagName.getText(file) === 'textarea') && controls.length === 1;
      if (eligible) {
        const control = controls[0];
        const type = attribute(control, 'type')?.initializer?.getText(file) ?? '';
        if (!/checkbox|radio|range|hidden|file|color/.test(type)) {
          const existingClass = attribute(tag, 'className');
          if (!existingClass) edits.push({ start: tag.tagName.end, end: tag.tagName.end, text: ' className="compact-field"' });
          else if (ts.isStringLiteral(existingClass.initializer)) {
            edits.push({ start: existingClass.initializer.end - 1, end: existingClass.initializer.end - 1, text: ' compact-field' });
          } else if (ts.isJsxExpression(existingClass.initializer) && existingClass.initializer.expression) {
            const expression = existingClass.initializer.expression;
            edits.push({ start: expression.getStart(file), end: expression.end, text: `(${expression.getText(file)}) + " compact-field"` });
          }
          if (name === 'label' && !children.some(child => child.tagName.getText(file) === 'span')) {
            const controlNode = node.children.find(child => opening(child) === control);
            const prefix = source.slice(tag.end, controlNode.getStart(file));
            if (prefix.trim()) {
              edits.push({ start: tag.end, end: tag.end, text: '<span>' });
              edits.push({ start: controlNode.getStart(file), end: controlNode.getStart(file), text: '</span>' });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  let result = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  if (result !== source) {
    const oldLines = source.split(/\r?\n/);
    const newLines = result.split(/\r?\n/);
    const hunks = [];
    for (let index = 0; index < oldLines.length; index++) {
      if (oldLines[index] === newLines[index]) continue;
      const start = Math.max(0, index - 1);
      const end = Math.min(oldLines.length, index + 3);
      const previous = hunks.at(-1);
      if (previous && start <= previous.end) previous.end = end;
      else hunks.push({ start, end });
    }
    const patch = hunks.map(({ start, end }) => '@@\n' + oldLines.slice(start, end).flatMap((line, index) =>
      line === newLines[start + index] ? [' ' + line] : ['-' + line, '+' + newLines[start + index]]).join('\n')).join('\n');
    changes.push({ filename, patch });
  }
}
visitFiles('src/modules');
visitFiles('src/shared');
console.log(JSON.stringify(process.argv[2] === '--list' ? changes.map(change => change.filename) : changes));
