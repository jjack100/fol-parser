import { basicSyntax, STree, Syntax } from "../src/syntax.js";
import { ParseError, ParseSuccess } from "../src/parser.js";
import { parse } from "../src/index.js"
import { describe, expect, test } from "vitest"

const sampleSyntax: Syntax = new Map([
  ...basicSyntax,
  ['funcF', { kind: 'function', label: 'F', style: 'prefix', arity: 1 }],
  ['funcG', { kind: 'function', label: 'G', style: 'prefix', arity: 2 }],
  ['funcH', { kind: 'function', label: 'H', style: 'prefix', arity: 3 }],
  ['+', { kind: 'function', label: 'plus', style: 'infix', arity: 2, precedence: 1 }],
  ['-', { kind: 'function', label: 'minus', style: 'infix', arity: 2, precedence: 1 }],
  ['cdot', { kind: 'function', label: 'times', style: 'infix', arity: 2, precedence: 2 }],
  ['predP', { kind: 'predicate', label: 'P', style: 'prefix', arity: 1 }],
  ['predQ', { kind: 'predicate', label: 'Q', style: 'prefix', arity: 2 }],
  ['predR', { kind: 'predicate', label: 'R', style: 'prefix', arity: 3 }]
])

describe('parser', () => {
  const expectSuccess = (input: string, expectedTree: STree, allowedSubs?: [string, string[]][]) => {
    const result = parse(input, sampleSyntax);
    expect(result).toMatchObject({
      kind: 'success',
      tree: expectedTree
    });
    if (allowedSubs !== undefined) {
      const subMap = new Map(allowedSubs.map(([key, val]) => [key, new Set(val)]));
      expect((result as ParseSuccess).allowedSubs).toEqual(subMap);
    }
  };

  const expectFailure = (input: string, msg?: ParseError['msg']) => {
    const result = parse(input, sampleSyntax);
    if (msg === undefined) expect(result).toMatchObject({ kind: 'error' });
    else expect(result).toMatchObject({ kind: 'error', msg });
  };

  describe('basic connectives', () => {
    test('parses connectives correctly', () => {
      expectSuccess('\\phi\\land\\psi', ['and', 'phi', 'psi']);
      expectSuccess('\\psi\\lor\\phi', ['or', 'psi', 'phi']);
      expectSuccess('\\psi\\rightarrow\\chi', ['implies', 'psi', 'chi']);
      expectSuccess('\\top\\leftrightarrow\\top', ['iff', 'true', 'true']);
      expectSuccess('\\neg\\neg\\bot', ['not', ['not', 'false']]);
    });

    test('parses negation correctly', () => {
      expectSuccess('\\neg\\phi', ['not', 'phi']);
      expectSuccess('\\neg\\neg\\phi', ['not', ['not', 'phi']]);
      expectSuccess('\\neg\\neg\\neg\\phi', ['not', ['not', ['not', 'phi']]]);
    });

    test('parses constants correctly', () => {
      expectSuccess('\\top', 'true');
      expectSuccess('\\bot', 'false');
    });

    test('rejects incomplete expressions', () => {
      expectFailure('\\not');
      expectFailure('\\and');
      expectFailure('\\phi\\land');
      expectFailure('\\land\\phi');
      expectFailure('\\phi\\rightarrow');
    });
  });

  describe('whitespace handling', () => {
    test('ignores whitespace between tokens', () => {
      expectSuccess('\\phi \\land \\psi', ['and', 'phi', 'psi']);
      expectSuccess('\\phi  \\land  \\psi', ['and', 'phi', 'psi']);
      expectSuccess('  \\phi\\land\\psi  ', ['and', 'phi', 'psi']);
    });

    test('handles whitespace in complex expressions', () => {
      expectSuccess('\\neg \\phi \\land \\psi',
        ['and', ['not', 'phi'], 'psi']);
      expectSuccess('( \\phi \\lor \\psi ) \\land \\chi',
        ['and', ['or', 'phi', 'psi'], 'chi']);
    });
  });

  describe('associativity', () => {
    test('parses left-associative connectives correctly', () => {
      expectSuccess('\\phi\\land\\psi\\land\\chi',
        ['and', ['and', 'phi', 'psi'], 'chi']);
      expectSuccess('\\phi\\land\\psi\\land\\chi\\land\\top',
        ['and', ['and', ['and', 'phi', 'psi'], 'chi'], 'true']);
      expectSuccess('\\phi\\lor\\psi\\lor\\chi',
        ['or', ['or', 'phi', 'psi'], 'chi']);
      expectSuccess('\\phi\\lor\\psi\\lor\\chi\\lor\\top',
        ['or', ['or', ['or', 'phi', 'psi'], 'chi'], 'true']);
    });

    test('parses right-associative connectives correctly', () => {
      expectSuccess('\\phi\\rightarrow\\psi\\rightarrow\\chi',
        ['implies', 'phi', ['implies', 'psi', 'chi']]);
      expectSuccess('\\phi\\leftrightarrow\\psi\\leftrightarrow\\chi',
        ['iff', 'phi', ['iff', 'psi', 'chi']]);
      expectSuccess('\\phi\\rightarrow\\psi\\rightarrow\\chi\\rightarrow\\top',
        ['implies', 'phi', ['implies', 'psi', ['implies', 'chi', 'true']]]);
    });
  });

  describe('precedence', () => {
    test('parses connective precedence correctly', () => {
      expectSuccess('\\phi\\land\\psi\\lor\\chi',
        ['or', ['and', 'phi', 'psi'], 'chi']);
      expectSuccess('\\phi\\lor\\psi\\land\\chi',
        ['or', 'phi', ['and', 'psi', 'chi']]);
    });

    test('negation has highest precedence', () => {
      expectSuccess('\\neg\\phi\\land\\psi',
        ['and', ['not', 'phi'], 'psi']);
      expectSuccess('\\neg\\phi\\lor\\psi',
        ['or', ['not', 'phi'], 'psi']);
      expectSuccess('\\neg\\phi\\rightarrow\\psi',
        ['implies', ['not', 'phi'], 'psi']);
    });

    test('and has higher precedence than or', () => {
      expectSuccess('\\phi\\land\\psi\\lor\\chi\\land\\top',
        ['or', ['and', 'phi', 'psi'], ['and', 'chi', 'true']]);
    });

    test('and/or have higher precedence than implies', () => {
      expectSuccess('\\phi\\land\\psi\\rightarrow\\chi',
        ['implies', ['and', 'phi', 'psi'], 'chi']);
      expectSuccess('\\phi\\rightarrow\\psi\\land\\chi',
        ['implies', 'phi', ['and', 'psi', 'chi']]);
      expectSuccess('\\phi\\lor\\psi\\rightarrow\\chi',
        ['implies', ['or', 'phi', 'psi'], 'chi']);
    });

    test('implies has higher precedence than iff', () => {
      expectSuccess('\\phi\\rightarrow\\psi\\leftrightarrow\\chi',
        ['iff', ['implies', 'phi', 'psi'], 'chi']);
      expectSuccess('\\phi\\leftrightarrow\\psi\\rightarrow\\chi',
        ['iff', 'phi', ['implies', 'psi', 'chi']]);
    });
  });

  describe('parentheses', () => {
    test('parentheses override precedence', () => {
      expectSuccess('(\\phi\\lor\\psi)\\land\\chi',
        ['and', ['or', 'phi', 'psi'], 'chi']);
      expectSuccess('\\phi\\land(\\psi\\lor\\chi)',
        ['and', 'phi', ['or', 'psi', 'chi']]);
      expectSuccess('\\phi\\lor(\\psi\\land\\chi)',
        ['or', 'phi', ['and', 'psi', 'chi']]);
    });

    test('parentheses work with left/right macros', () => {
      expectSuccess('\\left(\\phi\\lor\\psi\\right)\\land\\chi',
        ['and', ['or', 'phi', 'psi'], 'chi']);
      expectSuccess('\\phi\\land\\left(\\psi\\lor\\chi\\right)',
        ['and', 'phi', ['or', 'psi', 'chi']]);
      expectSuccess('\\phi\\lor\\left(\\psi\\land\\chi\\right)',
        ['or', 'phi', ['and', 'psi', 'chi']]);
    });

    test('parentheses override associativity', () => {
      expectSuccess('\\phi\\land(\\psi\\land\\chi)',
        ['and', 'phi', ['and', 'psi', 'chi']]);
      expectSuccess('(\\phi\\rightarrow\\psi)\\rightarrow\\chi',
        ['implies', ['implies', 'phi', 'psi'], 'chi']);
    });

    test('nested parentheses', () => {
      expectSuccess('((\\phi\\land\\psi)\\lor\\chi)',
        ['or', ['and', 'phi', 'psi'], 'chi']);
      expectSuccess('(\\phi\\land(\\psi\\lor(\\chi\\rightarrow\\top)))',
        ['and', 'phi', ['or', 'psi', ['implies', 'chi', 'true']]]);
    });

    test('parentheses with negation', () => {
      expectSuccess('\\neg(\\phi\\land\\psi)',
        ['not', ['and', 'phi', 'psi']]);
      expectSuccess('\\neg(\\phi\\lor\\psi)',
        ['not', ['or', 'phi', 'psi']]);
      expectSuccess('\\neg(\\neg\\phi)',
        ['not', ['not', 'phi']]);
    });

    test('parentheses with terms', () => {
      expectSuccess('(a)=b',
        ['eq', 'a', 'b']);
      expectSuccess('a+(b-c)=d',
        ['eq', ['plus', 'a', ['minus', 'b', 'c']], 'd']);
      expectSuccess('(a+b)\\cdot c=d',
        ['eq', ['times', ['plus', 'a', 'b'], 'c'], 'd']);
    });

    test('redundant parentheses', () => {
      expectSuccess('(\\phi)', 'phi');
      expectSuccess('(\\top)', 'true');
      expectSuccess('(\\phi\\land\\psi)', ['and', 'phi', 'psi']);
      expectSuccess('((a))=(b)', ['eq', 'a', 'b']);
    });
  });

  describe('quantifiers', () => {
    test('parses quantifiers correctly', () => {
      expectSuccess('\\forall x\\phi', ['forall', 'x', 'phi']);
      expectSuccess('\\exists y\\chi', ['exists', 'y', 'chi']);
      expectSuccess('(\\forall x\\phi)\\land(\\exists y \\psi)',
        ['and', ['forall', 'x', 'phi'], ['exists', 'y', 'psi']]);
    })
    test('parses nested quantifiers correctly', () => {
      expectSuccess('\\exists x\\forall y x = y',
        ['exists', 'x', ['forall', 'y', ['eq', 'x', 'y']]]);
      expectSuccess('\\forall z\\exists x\\forall y (x = y \\land y = z)',
        ['forall', 'z', ['exists', 'x', ['forall', 'y', ['and', ['eq', 'x', 'y'], ['eq', 'y', 'z']]]]]);
    })
    test('quantifiers have higher precedence than connectives', () => {
      expectSuccess('\\exists x \\phi\\land\\psi', ['and', ['exists', 'x', 'phi'], 'psi']);
    })
  })

  describe('predicates', () => {
    test('parses prefix-style predicates correctly', () => {
      expectSuccess('\\predP(a) \\land \\predQ(b,c)', ['and', ['P', 'a'], ['Q', 'b', 'c']]);
      expectSuccess('\\predR(a,b,c)', ['R', 'a', 'b', 'c']);
    })
    test('parses infix-style predicates correctly', () => {
      expectSuccess('a=b', ['eq', 'a', 'b']);
    })
    test('rejects predicates with wrong number of arguments', () => {
      expectFailure('\\predP(a,b)', 'WrongNumArgs');
      expectFailure('\\predR(a,b)', 'WrongNumArgs');
      expectFailure('\\predQ(a,b,c,d)', 'WrongNumArgs');
    })
  });

  describe('free variable declarations', () => {
    test('variables can be declared as free in a metavariable', () => {
      expectSuccess('\\forall x\\phi(x)',
        ['forall', 'x', 'phi'],
        [['phi', ['x']]]);
      expectSuccess('\\forall x \\forall y \\phi(x,y)\\land\\forall z\\psi(z)',
        ['and', ['forall', 'x', ['forall', 'y', 'phi']], ['forall', 'z', 'psi']],
        [['phi', ['x', 'y']], ['psi', ['z']]]);
      expectSuccess('\\forall x\\forall y(\\phi(x,y)\\land\\phi(x,y))',
        ['forall', 'x', ['forall', 'y', ['and', 'phi', 'phi']]],
        [['phi', ['x', 'y']]]);
      expectSuccess('\\forall x\\phi', ['forall', 'x', 'phi'], [['phi', []]])
    })
    test('declared free variables must be consistent', () => {
      expectFailure('\\forall x \\forall z (\\phi(x)\\land\\phi(z))',
        'InconsistentAllowedSubs');
      expectFailure('\\forall x \\forall y (\\phi(x,y)\\land\\phi(x))',
        'InconsistentAllowedSubs');
      expectFailure('\\forall x (\\phi\\land\\phi(x))',
        'InconsistentAllowedSubs');
    })
    test('consistency check ignores order', () => {
      expectSuccess('\\forall x \\forall y (\\phi(x,y)\\land\\phi(y,x))',
        ['forall', 'x', ['forall', 'y', ['and', 'phi', 'phi']]],
        [['phi', ['x', 'y']]]);
    })
    test('consistency check ignores duplicates', () => {
      expectSuccess('\\forall x (\\phi(x)\\land\\phi(x,x))',
        ['forall', 'x', ['and', 'phi', 'phi']],
        [['phi', ['x']]]);
    })
  })

  describe('variables', () => {
    test('variables s-z should not be free', () => {
      expectFailure('s=z', 'FreeVar');
      expectFailure('a=s', 'FreeVar');
      expectFailure('a=b \\land a=x', 'FreeVar');
      expectFailure('\\forall x x = z', 'FreeVar');
    })
    test('variables a-r may be used as eigenvariables', () => {
      expectSuccess('a=r', ['eq', 'a', 'r'])
      expectSuccess('\\forall x g = x', ['forall', 'x', ['eq', 'g', 'x']]);
    })
    test('eigenvariables may not be bound', () => {
      expectFailure('\\forall a a = a', 'BoundEigenvar');
    })
    test('eigenvariables should not be declared free (they are already always free)', () => {
      expectFailure('\\phi(a)', 'EigenvarDeclaredFree');
    })
  })

  describe('subscripts', () => {
    test('variables can be subscripted', () => {
      expectSuccess('a_1 = a_2', ['eq', 'a_1', 'a_2']);
      expectSuccess('\\exists z_6 z_6 = a', ['exists', 'z_6', ['eq', 'z_6', 'a']]);
      expectSuccess('\\phi_1\\land\\phi_2', ['and', 'phi_1', 'phi_2'])
    })
    test('groups can be used for multi-digit subscripts', () => {
      expectSuccess('a_{12} = b_{194}', ['eq', 'a_12', 'b_194']);
      expectSuccess('\\exists x_{44} (x_{44} = g_{2})', ['exists', 'x_44', ['eq', 'x_44', 'g_2']]);
      expectSuccess('\\phi_{24}\\land\\phi_{1234}', ['and', 'phi_24', 'phi_1234']);
    })
    test('groups are required for multi-digit subscripts', () => {
      expectFailure('a_12 = b_194');
      expectFailure('\\exists x_44 (x_44 = g_2)');
      expectFailure('\\phi_24\\land\\phi_1234');
    })
  })

  describe('functions', () => {
    test('parses prefix-style functions correctly', () => {
      expectSuccess('\\funcF(a) = \\funcG(b,c)', ['eq', ['F', 'a'], ['G', 'b', 'c']]);
      expectSuccess('\\funcF(\\funcF(a)) = a', ['eq', ['F', ['F', 'a']], 'a']);
      expectSuccess('\\funcH( a, \\funcF(a), \\funcG(b,c) ) = d',
        ['eq', ['H', 'a', ['F', 'a'], ['G', 'b', 'c']], 'd']);
    })
    test('infix-style functions are left-associative', () => {
      expectSuccess('a+b+c=d', ['eq', ['plus', ['plus', 'a', 'b'], 'c'], 'd'])
      expectSuccess('a-b-c=d', ['eq', ['minus', ['minus', 'a', 'b'], 'c'], 'd'])
      expectSuccess('a\\cdot b\\cdot c=d', ['eq', ['times', ['times', 'a', 'b'], 'c'], 'd'])
      expectSuccess('a+b-c=d', ['eq', ['minus', ['plus', 'a', 'b'], 'c'], 'd'])
    });
    test('parses precedence correctly for infix-style functions', () => {
      expectSuccess('a+b\\cdot c=d', ['eq', ['plus', 'a', ['times', 'b', 'c']], 'd']);
      expectSuccess('a\\cdot b+c=d', ['eq', ['plus', ['times', 'a', 'b'], 'c'], 'd']);
    })
    test('rejects functions with wrong number of arguments', () => {
      expectFailure('\\funcF(a,b)=c', 'WrongNumArgs');
      expectFailure('\\funcH(a,b)=c', 'WrongNumArgs');
      expectFailure('\\funcG(a,b,c,d)=e', 'WrongNumArgs');
    })
  });
});

