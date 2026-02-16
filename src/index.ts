import { failWith, parseFormula, ParseResult } from "./parser.js";
import { checkAllowedSubs, checkEigenvars, checkFreeVariables } from "./semantic-analyzer.js";
import { STree, Syntax } from "./syntax.js";
import { tokenize } from "./tokenizer.js";

export { basicSyntax } from "./syntax.js";
export { findInconsistency } from "./semantic-analyzer.js"

export type { ParseResult, ParseSuccess, ParseError, AllowedSubs } from "./parser.js";

export function parse(input: string, syntax: Syntax): ParseResult {
  const tokens = tokenize(input, syntax);
  if (input.length === 0) return failWith({ msg: 'BlankExpression' });
  const result = parseFormula(tokens);
  if (result.kind === 'error') return result;
  if (tokens.length > 0) return failWith({ msg: 'BadToken', actual: tokens[0].value });

  // Semantic analyzer checks
  const freeVar = checkFreeVariables(result.tree, syntax).values().next().value;
  if (freeVar !== undefined) return failWith({ msg: 'FreeVar', variable: freeVar })
  const processed = checkAllowedSubs(result.tree);
  if (processed.kind === 'error') return processed;
  const err = checkEigenvars(processed.allowedSubs);
  if (err !== null) return failWith(err);
  return processed;
}

export function treeToSExpr(tree: STree): string {
  return Array.isArray(tree)
    ? `( ${tree.map(treeToSExpr).join(" ")} )`
    : tree
}