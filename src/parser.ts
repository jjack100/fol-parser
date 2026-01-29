import { Connective, Function, isDigit, isEigenvar, STree } from "./syntax"
import { Token } from "./tokenizer"

export type ParseError =
  | { msg: 'BadToken', expected?: string, actual: string }
  | { msg: 'BlankExpression' }
  | { msg: 'BoundEigenvar', variable: string }
  | { msg: 'DoubleBound', variable: string }
  | { msg: 'EigenvarDeclaredFree', variable: string, metavariable: string }
  | { msg: 'FreeVar', variable: string }
  | { msg: 'InconsistentAllowedSubs', metavar: string }
  | { msg: 'UnexpectedEnd', expected?: string }
  | { msg: 'WrongNumArgs', symbol: string, expected: number, actual: number }

export type ParseSuccess = {
  tree: STree
  allowedSubs: Map<string, Set<string>>
}

export type AllowedSubs = Map<string, Set<string>>

export type ParseResult =
  | { kind: 'success' } & ParseSuccess
  | { kind: 'error' } & ParseError

type Parser = (tokens: Token[]) => ParseResult

// Get left and right binding power of a connective
function bpConn(op: Connective): [number, number] {
  if (op.style === 'nullary') return [-1, -1];
  const base = 4 * op.precedence;
  switch (op.style) {
    case 'prefix': return [-1, base];
    case 'infix': return op.associativity === 'left'
      ? [base + 2, base + 3] // Give left-associative ops higher precedence than right when ambiguous
      : [base + 1, base + 0]
  }
}

// Pratt-parse logical connectives and quantifiers based on precedence
export function parseFormula(tokens: Token[], minBp: number = 0): ParseResult {
  let lhs: STree;
  const first = tokens.at(0);
  if (first === undefined) return failWith({ msg: 'UnexpectedEnd' });
  if (first.kind === 'connective' && first.style === 'prefix') {
    tokens.shift();
    const [, rBp] = bpConn(first);
    const rhs = parseFormula(tokens, rBp);
    if (rhs.kind === 'error') return rhs;
    lhs = [first.label, rhs.tree];
  }
  // Treat quantifiers as having a higher precedence than all connectives
  else if (first.kind === 'quantifier') {
    tokens.shift();
    const boundTo = parseVariable(tokens);
    if (boundTo.kind === 'error') return boundTo;
    if (isEigenvar(boundTo.tree)) {
      return failWith({ msg: 'BoundEigenvar', variable: boundTo.tree })
    }
    const rhs = parseFormula(tokens, Infinity);
    if (rhs.kind === 'error') return rhs;
    lhs = [first.label, boundTo.tree, rhs.tree]
  }
  else {
    const res = parseBasicFormula(tokens);
    if (res.kind === 'error') return res;
    lhs = res.tree
  }
  let tree: STree = lhs;
  while (true) {
    const infix = tokens.at(0);
    if (infix === undefined) break;
    if (infix.kind !== 'connective' || infix.style !== 'infix') break;
    const [lBp, rBp] = bpConn(infix);
    if (lBp < minBp) break;
    tokens.shift();
    const rhs = parseFormula(tokens, rBp);
    if (rhs.kind === 'error') return rhs;
    tree = [infix.label, tree, rhs.tree];
  }
  return succeedWith(tree);
}

function parseBasicFormula(tokens: Token[]): ParseResult {
  const first = tokens.at(0);
  if (!first) return failWith({ msg: 'UnexpectedEnd' });
  if (first.kind === 'metavariable') {
    tokens.shift();
    let metavar: string = first.letter;
    if (tokens.at(0)?.value === '_') {
      const subscript = parseSubscript(tokens);
      if (subscript.kind === 'error') return subscript;
      metavar = `${metavar}_${subscript.tree}`;
    }
    if (delimUpNext(tokens, '(')) {
      const withVars = parseParens(tokens, tks => parseList(tks, parseVariable))
      if (withVars.kind === 'error') return withVars;
      return succeedWith(['_metavar', metavar, ...withVars.tree])
    }
    else return succeedWith(['_metavar', metavar]);
  }
  if (first.kind === 'connective' && first.style === 'nullary') {
    tokens.shift();
    return succeedWith(first.label);
  }
  if (first.kind === 'predicate' && first.style === 'prefix') {
    tokens.shift();
    const args = parseParens(tokens, tks => parseList(tks, parseTerm))
    if (args.kind === 'error') return args;
    if (args.tree.length !== first.arity) return failWith(
      { msg: 'WrongNumArgs', symbol: first.value, expected: first.arity, actual: args.tree.length });
    return succeedWith([first.label, ...args.tree]);
  }
  if (delimUpNext(tokens, '(')) {
    // Parentheses can be around either a formula or term, so backtrack on failure
    const res = tryParse(tokens, tks => parseParens(tks, parseFormula));
    if (res.kind === 'success') return res;
  }
  return parseInfixPred(tokens);
}

function parseInfixPred(tokens: Token[]): ParseResult {
  const lhs = parseTerm(tokens);
  if (lhs.kind === 'error') return lhs;
  const pred = tokens.shift();
  if (!pred) return failWith({ msg: 'UnexpectedEnd' });
  if (pred.kind !== 'predicate' || pred.style !== 'infix') {
    return failWith({ msg: 'BadToken', actual: pred.value })
  }
  const rhs = parseTerm(tokens);
  if (rhs.kind === 'error') return rhs;
  return succeedWith([pred.label, lhs.tree, rhs.tree])
}

// Get left and right binding power of a function
function bpFunc(op: Function): [number, number] {
  if (op.style !== 'infix') return [-1, -1];
  const base = 2 * op.precedence;
  return [base + 0, base + 1]
}

// Pratt-parse function operators based on precedence
export function parseTerm(tokens: Token[], minBp: number = 0): ParseResult {
  const first = tokens.at(0);
  if (first === undefined) return failWith({ msg: 'UnexpectedEnd' });

  const res = parseBasicTerm(tokens);
  if (res.kind === 'error') return res;
  const lhs = res.tree

  let tree: STree = lhs;
  while (true) {
    const infix = tokens.at(0);
    if (infix === undefined) break;
    if (infix.kind !== 'function' || infix.style !== 'infix') break;
    const [lBp, rBp] = bpFunc(infix);
    if (lBp < minBp) break;
    tokens.shift();
    const rhs = parseTerm(tokens, rBp);
    if (rhs.kind === 'error') return rhs;
    tree = [infix.label, tree, rhs.tree];
  }
  return succeedWith(tree);
}

function parseBasicTerm(tokens: Token[]): ParseResult {
  const next = tokens.at(0);
  if (next === undefined) return failWith({ msg: 'UnexpectedEnd' });
  if (next.kind === 'function' && next.style === 'prefix') {
    tokens.shift();
    const args = parseParens(tokens, tks => parseList(tks, parseBasicTerm))
    if (args.kind === 'error') return args;
    if (args.tree.length !== next.arity) return failWith(
      { msg: 'WrongNumArgs', symbol: next.value, expected: next.arity, actual: args.tree.length });
    return succeedWith([next.label, ...args.tree]);
  }
  if (delimUpNext(tokens, '(')) return parseParens(tokens, parseTerm);
  return parseVariable(tokens);
}

function parseVariable(tokens: Token[]): ParseResult {
  const next = tokens.shift();
  if (!next) return failWith({ msg: 'UnexpectedEnd' });
  if (!/[a-z]/.test(next.value)) return failWith({ msg: 'BadToken', actual: next.value });
  if (tokens.at(0)?.value === '_') {
    const subscript = parseSubscript(tokens);
    if (subscript.kind === 'error') return subscript;
    return succeedWith(`${next.value}_${subscript.tree}`);
  }
  else return succeedWith(next.value);
}

function parseParens(tokens: Token[], parser: Parser): ParseResult {
  return parseDelimiter(tokens, '(', ')', parser);
}

function parseDelimiter(
  tokens: Token[],
  lDelim: string,
  rDelim: string,
  parser: Parser
): ParseResult {
  const first = tokens.shift();
  if (!first) return failWith({ msg: 'UnexpectedEnd', expected: lDelim });
  // Accept a delimiter that uses LaTeX macros \left and \right
  if (first.value === '\\left') {
    // Expect the left delimiter after \left
    const second = expect(tokens, lDelim);
    if (second.kind === 'error') return second;
    // Parse inbetween them
    const result = parser(tokens);
    if (result.kind === 'error') return result;
    // Expect \right
    const right = expect(tokens, '\\right');
    if (right.kind === 'error') return right;
    // And then the actual right delimiter
    const end = expect(tokens, rDelim);
    if (end.kind === 'error') return end;
    return result;
  }
  // Or accept it without \left and \right
  else if (first.value === lDelim) {
    const result = parser(tokens);
    if (result.kind === 'error') return result;
    const next = expect(tokens, rDelim);
    if (next.kind === 'error') return next;
    return result;
  }
  else return failWith({ msg: 'BadToken', expected: lDelim, actual: first.value });
}

function delimUpNext(tokens: Token[], delim: string): boolean {
  return tokens.at(0)?.value === delim || (tokens.at(0)?.value === '\\left' && tokens.at(1)?.value === delim)
}

function parseSubscript(tokens: Token[]): ParseResult {
  const underscore = expect(tokens, '_');
  if (underscore.kind === 'error') return underscore;
  const first = tokens.at(0);
  if (first === undefined) return failWith({ msg: 'UnexpectedEnd' });
  // A single digit number needn't be in a group
  if (first.kind === 'char' && isDigit(first.value)) {
    tokens.shift();
    return succeedWith(first.value);
  }
  // Multi-digit numbers do
  return parseGroup(tokens, parseInteger);
}

function parseGroup(tokens: Token[], parser: Parser): ParseResult {
  const lBrace = expect(tokens, '{');
  if (lBrace.kind === 'error') return lBrace;
  const result = parser(tokens);
  if (result.kind === 'error') return result;
  const rBrace = expect(tokens, '}');
  if (rBrace.kind === 'error') return rBrace;
  return result;
}

function parseInteger(tokens: Token[]): ParseResult {
  let result = "";
  const digitTok = (tok: Token | undefined) =>
    tok && tok.kind === 'char' && isDigit(tok.value)
  while (digitTok(tokens.at(0))) {
    result += tokens.shift()?.value ?? "";
  }
  if (result === "") {
    if (tokens.length === 0) return failWith({ msg: 'UnexpectedEnd' });
    return failWith({ msg: 'BadToken', actual: tokens[0].value });
  }
  return succeedWith(result);
}

function parseList(
  tokens: Token[],
  parser: Parser
): ParseResult {
  const first = parser(tokens);
  if (first.kind === 'error') return first;
  const result = [first.tree];
  while (tokens.at(0)?.value === ',') {
    tokens.shift();
    const next = parser(tokens);
    if (next.kind === 'error') return next;
    result.push(next.tree);
  }
  return succeedWith(result);
}

// Run a parser but don't consume input on failure
function tryParse(tokens: Token[], parser: Parser): ParseResult {
  const oldTokens = [...tokens];
  const result = parser(tokens);
  if (result.kind === 'error') {
    // Restore old tokens
    tokens.length = 0;
    tokens.push(...oldTokens);
  }
  return result;
}

function expect(tokens: Token[], value: string): ParseResult {
  const next = tokens.shift();
  if (next === undefined) return failWith({ msg: 'UnexpectedEnd', expected: value });
  if (next.value !== value) return failWith({ msg: 'BadToken', expected: value, actual: next.value });
  return succeedWith(next.value);
}

export function succeedWith(val: STree, allowedSubs: AllowedSubs = new Map()): ParseResult {
  return { kind: 'success', tree: val, allowedSubs }
}
export function failWith(val: ParseError): ParseResult {
  return { kind: 'error', ...val }
}