export type SyntaxConstruct =
  | { kind: 'connective' } & Connective
  | { kind: 'quantifier' } & Quantifier
  | { kind: 'predicate' } & Predicate
  | { kind: 'function' } & Function

export type Syntax = Map<string, SyntaxConstruct>

export type Connective =
  | { style: 'prefix', label: string, precedence: number }
  | { style: 'infix', label: string, precedence: number, associativity: 'left' | 'right' }
  | { style: 'nullary', label: string }
export type Quantifier = { label: string }
export type Predicate =
  | { style: 'prefix', label: string, arity: number }
  | { style: 'infix', label: string, arity: 2 }
export type Function =
  | { style: 'prefix', label: string, arity: number }
  | { style: 'infix', label: string, arity: 2, precedence: number }

export const basicSyntax: Map<string, SyntaxConstruct> = new Map([
  ['neg', {
    kind: 'connective',
    style: 'prefix',
    label: 'not',
    precedence: 4
  }],
  ['land', {
    kind: 'connective',
    style: 'infix',
    label: 'and',
    precedence: 3,
    associativity: 'left'
  }],
  ['lor', {
    kind: 'connective',
    style: 'infix',
    label: 'or',
    precedence: 2,
    associativity: 'left'
  }],
  ['rightarrow', {
    kind: 'connective',
    style: 'infix',
    label: 'implies',
    precedence: 1,
    associativity: 'right'
  }],
  ['leftrightarrow', {
    kind: 'connective',
    style: 'infix',
    label: 'iff',
    precedence: 0,
    associativity: 'right'
  }],
  ['top', {
    kind: 'connective',
    style: 'nullary',
    label: 'true',
  }],
  ['bot', {
    kind: 'connective',
    style: 'nullary',
    label: 'false',
  }],
  ['exists', {
    kind: 'quantifier',
    label: 'exists'
  }],
  ['forall', {
    kind: 'quantifier',
    label: 'forall'
  }],
  ['=', {
    kind: 'predicate',
    style: 'infix',
    arity: 2,
    label: 'eq'
  }]
])

export type STree = STree[] | string

export function isEigenvar(val: STree): val is string {
  return typeof val === 'string' && /^[a-r](_[0-9]+)?$/.test(val)
}

export function isRegVar(val: STree): val is string {
  return typeof val === 'string' && /^[s-z](_[0-9]+)?$/.test(val)
}

export function isDigit(val: STree): val is string {
  return typeof val === 'string' && /^[0-9]$/.test(val);
}

