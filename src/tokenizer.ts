import { Syntax, SyntaxConstruct } from "./syntax.js";

export type Token = (
  | SyntaxConstruct
  | { kind: 'char' }
  | { kind: 'metavariable', letter: 'phi' | 'psi' | 'chi' }
  | { kind: 'unrecognized' }
) & { value: string }

export function tokenize(input: string, syntax: Syntax): Token[] {
  const tokens: Token[] = [];
  let ctrlSeq: string | null = null;

  // Identify if a control sequence has a special meaning
  const endCtrlSeq = () => {
    if (ctrlSeq === null) return;
    const value = `\\${ctrlSeq}`;
    let token: Token;
    switch (ctrlSeq) {
      case 'phi':
      case 'psi':
      case 'chi':
        token = { kind: 'metavariable', letter: ctrlSeq, value }; break;
      default:
        token = { ...(syntax.get(ctrlSeq) ?? { kind: 'unrecognized' }), value }
    }
    tokens.push(token);
    ctrlSeq = null;
  }

  for (const char of input) {
    // If we're in a control word, accept new letter characters
    if (ctrlSeq !== null && /[a-zA-Z]/.test(char)) {
      ctrlSeq += char;
    }
    // If it's not a letter but is the first in the control sequence, it's a control symbol
    else if (ctrlSeq === '') {
      ctrlSeq += char;
      endCtrlSeq();
    }
    // Otherwise we're not in a control sequence
    else {
      endCtrlSeq();
      switch (char) {
        case '\\': ctrlSeq = ''; break; // Start a control sequence on backslash
        case ' ': break; // Ignore whitespace
        default: tokens.push({ ...(syntax.get(char) ?? { kind: 'char' }), value: char })
      }
    }
  }
  endCtrlSeq();
  return tokens;
}