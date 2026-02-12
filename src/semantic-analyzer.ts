import { AllowedSubs, failWith, ParseError, ParseResult, succeedWith } from "./parser.js";
import { isEigenvar, isRegVar, STree, Syntax } from "./syntax.js";

/**
 * Extracts all free variables from a syntax tree, accounting for variable binding by quantifiers.
 * @param tree - The syntax tree to analyze
 * @param syntax - The syntax definition containing operator information
 * @returns A set of all free variables in the tree
 */
export function checkFreeVariables(tree: STree, syntax: Syntax): Set<string> {
    if (typeof tree === 'string') {
        return new Set(isRegVar(tree) ? [tree] : [])
    }
    const [op, ...args] = tree;
    const symbol = typeof op === 'string' ? syntax.get(op) : undefined;
    if (symbol !== undefined && symbol.kind === 'quantifier') {
        const [variable, scope] = args as [string, STree];
        const res = checkFreeVariables(scope, syntax);
        res.delete(variable);
        return res;
    }
    else {
        return args.reduce<Set<string>>(
            (acc, cur) => acc.union(checkFreeVariables(cur, syntax)),
            new Set())
    }
}

/**
 * Validates and extracts allowed substitutions (free variables) for metavariables in the syntax tree.
 * @param tree - The syntax tree to analyze
 * @returns A ParseResult containing the tree and a map of metavariables to their allowed free variables,
 *          or an error if inconsistencies are found
 */
export function checkAllowedSubs(tree: STree): ParseResult {
    if (typeof tree === 'string') return succeedWith(tree);
    const [op, ...args] = tree;
    if (op === '_metavar') {
        const [metavar, ...freeVars] = args as string[];
        return succeedWith(metavar, new Map([[metavar, new Set(freeVars)]]))
    }
    else {
        const results = args.map(checkAllowedSubs);
        const newArgs = results.reduce((acc, cur) => {
            if (acc.kind === 'error') return acc;
            if (cur.kind === 'error') return cur;

            const inconsistency = findInconsistency(acc.allowedSubs, cur.allowedSubs);
            if (inconsistency !== undefined) {
                return failWith({ msg: 'InconsistentAllowedSubs', metavar: inconsistency[0] })
            }
            const newSub = new Map([...acc.allowedSubs, ...cur.allowedSubs]);
            return succeedWith([...acc.tree, cur.tree], newSub);
        }, succeedWith([]))
        if (newArgs.kind === 'error') return newArgs;
        return succeedWith([op, ...newArgs.tree], newArgs.allowedSubs);
    }
}

/**
 * Checks for double variable bindings (for example, shadowing) in the syntax tree.
 * @param tree - The syntax tree to analyze
 * @param syntax - The syntax definition containing operator information
 * @returns An object with either an error (if double binding is found) or a set of all bound variables
 */
export function checkDoubleBindings(
  tree: STree,
  syntax: Syntax
): { err: true } & ParseError | { err: false, bound: Set<string> } {

  if (typeof tree === 'string') return { err: false, bound: new Set() };
  const [op, ...args] = tree;
  const symbol = typeof op === 'string' ? syntax.get(op) : undefined;
  if (symbol !== undefined && symbol.kind === 'quantifier') {
    const [variable, scope] = args as [string, STree];
    const res = checkDoubleBindings(scope, syntax);
    if (res.err) return res;
    // Check shadowed variable
    if (res.bound.has(variable)) return { err: true, msg: 'DoubleBound', variable }
    res.bound.add(variable);
    return res;
  }
  else {
    return args.reduce<ReturnType<typeof checkDoubleBindings>>(
      (acc, cur) => {
        if (acc.err) return acc;
        const res = checkDoubleBindings(cur, syntax);
        if (res.err) return res;
        const shared = acc.bound.intersection(res.bound).values().next().value;
        if (shared !== undefined) return { err: true, msg: 'DoubleBound', variable: shared }
        return { err: false, bound: acc.bound.union(res.bound) }
      }, { err: false, bound: new Set() })
  }
}

/**
 * Checks if any metavariable's allowed free variables include eigenvariables.
 * @param allowedSubs - A map of metavariables to their allowed free variables
 * @returns A ParseError if eigenvariables are declared as free, or null if validation passes
 */
export function checkEigenvars(allowedSubs: AllowedSubs): ParseError | null {
  for (const [metavariable, frees] of allowedSubs) {
    for (const freeVar of frees) {
      if (isEigenvar(freeVar)) {
        return { msg: 'EigenvarDeclaredFree', variable: freeVar, metavariable };
      }
    }
  }
  return null;
}

/**
 * Finds the first metavariable that has inconsistent allowed free variables between two AllowedSubs maps.
 * @param a - The first AllowedSubs map
 * @param b - The second AllowedSubs map
 * @returns A tuple of [metavariable, allowedSet] if an inconsistency is found, or undefined otherwise
 */
function findInconsistency(a: AllowedSubs, b: AllowedSubs) {
    return a.entries().find(([key, val]) => {
        const correlate = b.get(key);
        if (correlate === undefined) return false;
        return val.symmetricDifference(correlate).size > 0;
    })
}