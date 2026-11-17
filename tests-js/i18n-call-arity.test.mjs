// Test tĩnh: mọi lời gọi `L(...)`/`pick(locale, ...)` của `js/i18n.js` (và hàm bọc chuyển tiếp tham số rest tới chúng)
// có đúng `SITE_LOCALES.length` biến thể. Biến thể đi theo vị trí locale nên thiếu một biến thể là trang của locale đó
// ném lỗi lúc dựng. Lời gọi trải bảng tuple (`pick(locale, ...LABELS[key])`) được lần tới mảng literal để đếm.
// File `.astro` không parse ở đây; `pick` ném lỗi khi thiếu biến thể nên build dựng mọi trang sẽ bắt.
// `I18N_ARITY_LOCALES=vi,zh,ja` cho phép kiểm trước số biến thể của danh sách locale sắp bật.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";
import { SITE_LOCALES } from "../js/i18n.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const EXPECTED = process.env.I18N_ARITY_LOCALES
  ? process.env.I18N_ARITY_LOCALES.split(",").map((value) => value.trim()).filter(Boolean).length
  : SITE_LOCALES.length;
const ITERATION_METHODS = new Set(["map", "forEach", "find", "filter", "some", "every", "flatMap"]);

const walk = (dir, accept) => readdirSync(join(ROOT, dir), { recursive: true })
  .map(String)
  .filter((file) => accept(file))
  .map((file) => join(ROOT, dir, file));

function sourceFiles() {
  return [
    ...walk("js", (file) => file.endsWith(".js")),
    ...walk("src", (file) => /\.(ts|mjs|js)$/.test(file) && !file.endsWith(".d.ts")),
    ...walk("scripts", (file) => !file.includes("/") && file.endsWith(".mjs")),
  ];
}

class Unresolved extends Error {}

function analyze() {
  const files = sourceFiles();
  const program = ts.createProgram(files, {
    allowJs: true,
    noEmit: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
  });
  const checker = program.getTypeChecker();
  const i18n = program.getSourceFile(join(ROOT, "js/i18n.js"));
  assert.ok(i18n, "không nạp được js/i18n.js");
  const moduleSymbol = checker.getSymbolAtLocation(i18n);
  const exported = new Map(checker.getExportsOfModule(moduleSymbol).map((symbol) => [symbol.name, symbol]));
  /** Hàm chọn biến thể → số tham số đứng trước biến thể (`pick` có `locale`). */
  const targets = new Map([[exported.get("L"), 0], [exported.get("pick"), 1]]);

  const resolveSymbol = (node) => {
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol;
  };
  const unwrap = (node) => {
    let current = node;
    while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression(current)
      || (ts.isCallExpression(current) && current.expression.getText() === "Object.freeze" && current.arguments.length === 1)) {
      current = ts.isCallExpression(current) ? current.arguments[0] : current.expression;
    }
    return current;
  };
  const isNullish = (node) => node.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(node) && node.text === "undefined");
  const declarationOf = (identifier) => resolveSymbol(identifier)?.valueDeclaration;

  /** Các phần tử của một bảng (object/array literal) mà lời gọi trải ra. */
  function tableEntries(node, depth) {
    if (depth > 8) throw new Unresolved("lần quá sâu");
    const expr = unwrap(node);
    if (ts.isIdentifier(expr)) {
      const declaration = declarationOf(expr);
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return tableEntries(declaration.initializer, depth + 1);
      throw new Unresolved(`không thấy bảng ${expr.text}`);
    }
    if (ts.isObjectLiteralExpression(expr)) {
      return expr.properties.map((property) => {
        if (!ts.isPropertyAssignment(property)) throw new Unresolved("thuộc tính bảng không phải gán trực tiếp");
        return property.initializer;
      });
    }
    if (ts.isArrayLiteralExpression(expr)) return [...expr.elements];
    throw new Unresolved(`bảng dạng ${ts.SyntaxKind[expr.kind]}`);
  }

  /** Độ dài các tuple mà `node` có thể nhận (rỗng nếu chỉ có thể là null/undefined). */
  function tupleLengths(node, depth = 0) {
    if (depth > 8) throw new Unresolved("lần quá sâu");
    const expr = unwrap(node);
    if (isNullish(expr)) return [];
    if (ts.isArrayLiteralExpression(expr)) {
      if (expr.elements.some(ts.isSpreadElement)) throw new Unresolved("tuple có phần tử trải");
      return [expr.elements.length];
    }
    if (ts.isBinaryExpression(expr) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(expr.operatorToken.kind)) {
      return [...tupleLengths(expr.left, depth + 1), ...tupleLengths(expr.right, depth + 1)];
    }
    if (ts.isConditionalExpression(expr)) return [...tupleLengths(expr.whenTrue, depth + 1), ...tupleLengths(expr.whenFalse, depth + 1)];
    if (ts.isElementAccessExpression(expr) || ts.isPropertyAccessExpression(expr)) {
      return tableEntries(expr.expression, depth + 1).flatMap((entry) => tupleLengths(entry, depth + 1));
    }
    if (ts.isCallExpression(expr)) {
      const callee = expr.expression;
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === "find") {
        return tableEntries(callee.expression, depth + 1).flatMap((entry) => tupleLengths(entry, depth + 1));
      }
      const declaration = ts.isIdentifier(callee) ? declarationOf(callee) : null;
      const fn = declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
      if (fn && (ts.isFunctionDeclaration(fn) || ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && fn.body) {
        if (!ts.isBlock(fn.body)) return tupleLengths(fn.body, depth + 1);
        const lengths = [];
        const visit = (child) => {
          if (ts.isReturnStatement(child) && child.expression) lengths.push(...tupleLengths(child.expression, depth + 1));
          else if (!ts.isFunctionLike(child)) ts.forEachChild(child, visit);
        };
        ts.forEachChild(fn.body, visit);
        return lengths;
      }
      throw new Unresolved(`lời gọi ${callee.getText()}`);
    }
    if (ts.isIdentifier(expr)) {
      const declaration = declarationOf(expr);
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return tupleLengths(declaration.initializer, depth + 1);
      if (declaration && ts.isParameter(declaration) && ts.isIdentifier(declaration.name) && declaration.parent.parameters[0] === declaration) {
        // Tham số đầu của callback `BẢNG.map((tuple) => …)`: tuple là phần tử của bảng.
        const call = declaration.parent.parent;
        if (ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) && ITERATION_METHODS.has(call.expression.name.text)) {
          return tableEntries(call.expression.expression, depth + 1).flatMap((entry) => tupleLengths(entry, depth + 1));
        }
      }
      throw new Unresolved(`không lần được ${expr.text}`);
    }
    throw new Unresolved(`biểu thức ${ts.SyntaxKind[expr.kind]}`);
  }

  const callsOf = (sourceFile, visitCall) => {
    const visit = (node) => {
      if (ts.isCallExpression(node)) visitCall(node);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  };
  const projectFiles = program.getSourceFiles().filter((file) => !file.isDeclarationFile && files.includes(file.fileName));

  // Hàm bọc `(…, ...variants) => pick(locale, ...variants)`: lời gọi tới hàm bọc cũng phải đủ biến thể.
  for (let changed = true; changed;) {
    changed = false;
    for (const sourceFile of projectFiles) {
      callsOf(sourceFile, (call) => {
        const offset = targets.get(resolveSymbol(call.expression));
        if (offset === undefined || call.arguments.length !== offset + 1 || !ts.isSpreadElement(call.arguments[offset])) return;
        const spread = call.arguments[offset].expression;
        const declaration = ts.isIdentifier(spread) ? declarationOf(spread) : null;
        if (!declaration || !ts.isParameter(declaration) || !declaration.dotDotDotToken) return;
        const fn = declaration.parent;
        const owner = ts.isFunctionDeclaration(fn) ? fn.name : ts.isVariableDeclaration(fn.parent) ? fn.parent.name : null;
        const symbol = owner && resolveSymbol(owner);
        if (symbol && !targets.has(symbol)) {
          targets.set(symbol, fn.parameters.indexOf(declaration));
          changed = true;
        }
      });
    }
  }

  const problems = [];
  let checked = 0;
  for (const sourceFile of projectFiles) {
    callsOf(sourceFile, (call) => {
      const offset = targets.get(resolveSymbol(call.expression));
      if (offset === undefined) return;
      const where = `${relative(ROOT, sourceFile.fileName)}:${sourceFile.getLineAndCharacterOfPosition(call.getStart()).line + 1}`;
      const variants = call.arguments.slice(offset);
      const spreads = variants.filter(ts.isSpreadElement);
      checked += 1;
      if (spreads.length === 0) {
        if (variants.length !== EXPECTED) problems.push(`${where}: ${call.expression.getText()}(…) có ${variants.length} biến thể, cần ${EXPECTED}`);
        return;
      }
      if (variants.length !== 1) {
        problems.push(`${where}: trộn biến thể trải và biến thể rời, không đếm được`);
        return;
      }
      const spread = spreads[0].expression;
      const declaration = ts.isIdentifier(spread) ? declarationOf(spread) : null;
      if (declaration && ts.isParameter(declaration) && declaration.dotDotDotToken) return; // hàm bọc, đã kiểm ở lời gọi tới nó
      try {
        const lengths = tupleLengths(spread);
        if (lengths.length === 0) problems.push(`${where}: không tìm thấy tuple biến thể`);
        for (const length of lengths) if (length !== EXPECTED) problems.push(`${where}: tuple ${length} biến thể, cần ${EXPECTED}`);
      } catch (error) {
        if (!(error instanceof Unresolved)) throw error;
        problems.push(`${where}: không đếm được biến thể (${error.message})`);
      }
    });
  }
  return { problems, checked };
}

test(`mọi lời gọi L()/pick() có đúng ${EXPECTED} biến thể`, () => {
  const { problems, checked } = analyze();
  assert.deepEqual(problems, []);
  // Chống test rỗng: kho chuỗi hiện có hơn 2.000 lời gọi.
  assert.ok(checked > 2000, `chỉ kiểm được ${checked} lời gọi`);
});
