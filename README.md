# FOL Parser

A TypeScript library for parsing for first-order logic (FOL) formulas written in $\LaTeX$ notation, and transforming them into S-expressions that correspond to the syntax used in [FitchToMM](https://github.com/jjack100/FitchToMM).

## Usage

### Basic Parsing

```typescript
import { parse, basicSyntax } from 'fol-parser';

// Parse a simple formula
const result = parse('\\forall x (\\phi(x) \\land \\psi(x))', basicSyntax);

if (result.kind === 'success') {
  console.log('Parse tree:', result.tree);
  console.log('Allowed substitutions:', result.allowedSubs);
} else {
  console.error('Parse error:', result.msg);
}
```

### Custom Syntax

You can extend the basic syntax with custom predicates and functions:

```typescript
const customSyntax = new Map([
  ...basicSyntax,
  ['predP', { 
    kind: 'predicate', 
    label: 'P', 
    style: 'prefix', 
    arity: 1 
  }],
  ['+', { 
    kind: 'function', 
    label: 'plus', 
    style: 'infix', 
    arity: 2, 
    precedence: 1 
  }]
]);

const result = parse('\\predP(a) \\land b + c = d', customSyntax);
```
## LaTeX Syntax

The `basicSyntax` object provides a default syntax for logical symbols:

### Logical Constants

| Symbol | Meaning |
|--------|---------|
| `\top` | True ($\top$) |
| `\bot` | False ($\bot$) |

### Connectives

| Symbol | Meaning |
|--------|---------|
| `\lnot` | Negation ($\lnot$) |
| `\land` | Conjunction ($\land$) |
| `\lor` | Disjunction ($\lor$) |
| `\rightarrow` | Implication ($\rightarrow$) |
| `\leftrightarrow` | Biconditional ($\leftrightarrow$) |

### Quantifiers

| Symbol | Meaning |
|--------|---------|
| `\forall x` | Universal quantifier ($\forall x$) |
| `\exists x` | Existential quantifier ($\exists x$) |

### Predicates

| Symbol | Meaning |
|--------|---------|
| `=` | Identity predicate |


### Variables

We use Greek letters $\phi$, $\psi$, and $\chi$ for metavariables ranging over formulae.
Variables can be declared as free in a metavariable with the notation $\phi(x_1,x_2,\ldots, x_n)$.
The parser will check that these declarations are consistent across multiple uses of the same metavariable, and produce a map of which variables are free in which metavariables.

Following the conventions found in [forall x: Calgary](https://forallx.openlogicproject.org/), letters $a–r$ are treated as names/eigenvariables (e.g., they cannot be bound), and letters $s–z$ are used for regular variables.

Variables and metavariables may also be distinguished with subscripts (e.g., `x_{1}` for $x_{1}$).