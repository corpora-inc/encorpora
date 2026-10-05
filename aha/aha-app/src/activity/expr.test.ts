import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, evaluateConstant, ExprError, monomialSignatures, parseExpr } from './expr';

const val = (s: string, scope: Record<string, number> = {}, vars = Object.keys(scope)) => evaluate(parseExpr(s, vars), scope);

describe('safe expression evaluator', () => {
  it('respects precedence, associativity and unary minus', () => {
    assert.equal(evaluateConstant('2+3*4'), 14);
    assert.equal(evaluateConstant('(2+3)*4'), 20);
    assert.equal(evaluateConstant('2^3^2'), 512);
    assert.equal(evaluateConstant('-3^2'), -9);
    assert.equal(evaluateConstant('2^-1'), 0.5);
    assert.equal(evaluateConstant('10-4-3'), 3);
    assert.equal(evaluateConstant('4 - (-3)'), 7);
  });
  it('supports implicit multiplication, functions, constants and unicode operators', () => {
    assert.equal(val('2x+1', { x: 3 }), 7);
    assert.equal(val('3(x+1)', { x: 2 }), 9);
    assert.equal(val('(x+1)(x-1)', { x: 4 }), 15);
    assert.equal(val('xy', { x: 2, y: 5 }), 10);
    assert.equal(evaluateConstant('sqrt(6^2+8^2)'), 10);
    assert.ok(Math.abs(evaluateConstant('pi*5^2') - 78.5398) < 1e-3);
    assert.equal(evaluateConstant('6 × 7 − 2 ÷ 2'), 41);
    assert.equal(val('x²', { x: 3 }), 9);
    assert.equal(evaluateConstant('max(2, 9)'), 9);
  });
  it('round takes one input, or two to round to decimal places (negative: tens, hundreds)', () => {
    assert.equal(evaluateConstant('round(2.5)'), 3);
    assert.equal(evaluateConstant('round(3.14159, 2)'), 3.14);
    assert.equal(evaluateConstant('round(1.005, 2)'), 1.01, 'exponent shifting avoids the binary 1.00499… trap');
    assert.equal(evaluateConstant('round(2.675, 2)'), 2.68);
    assert.equal(evaluateConstant('round(12.5/4, 1)'), 3.1);
    assert.equal(evaluateConstant('round(1234, -2)'), 1200);
    assert.equal(evaluateConstant('round(7, 0)'), 7);
    assert.equal(evaluateConstant('round(0.000001234, 8)'), 0.00000123, 'tiny values written in exponent form');
    assert.ok(Number.isNaN(evaluateConstant('round(2.5, 0.5)')), 'digits must be a whole number');
    assert.ok(Number.isNaN(evaluateConstant('round(2.5, 11)')), 'digits are bounded');
    assert.throws(() => evaluateConstant('round(1, 2, 3)'), /round takes 1 or 2 input\(s\)/);
    assert.throws(() => evaluateConstant('max(1)'), /max takes 2 input\(s\)/);
  });
  it('returns NaN for undefined values instead of throwing', () => {
    assert.ok(Number.isNaN(evaluateConstant('1/0')));
    assert.ok(Number.isNaN(evaluateConstant('sqrt(-1)')));
    assert.ok(Number.isNaN(evaluateConstant('10^5000')));
  });
  it('rejects unknown variables, code, and malformed input', () => {
    for (const bad of ['x+1', 'alert(1)', 'constructor', '2 3', '(1+2', '1+2)', '', '1+', 'Math.PI', 'process.exit()', '__proto__', '1;2', '`1`', "'1'"]) {
      assert.throws(() => evaluateConstant(bad), ExprError, bad);
    }
    assert.throws(() => parseExpr('2y', ['x']), /Use only x/);
  });
  it('bounds length and depth', () => {
    assert.throws(() => evaluateConstant('1+'.repeat(150) + '1'), /too long/);
    assert.throws(() => evaluateConstant('('.repeat(60) + '1' + ')'.repeat(60)), /nested too deeply|too long/);
    assert.throws(() => evaluateConstant('-'.repeat(60) + '1'), /nested too deeply/);
  });
  it('classifies polynomial shape for form checks', () => {
    assert.deepEqual(monomialSignatures(parseExpr('4x+12', ['x'])), ['x^1', '1']);
    assert.equal(monomialSignatures(parseExpr('4(x+3)', ['x'])), null);
    assert.deepEqual(monomialSignatures(parseExpr('3x+2x', ['x'])), ['x^1', 'x^1']);
    assert.deepEqual(monomialSignatures(parseExpr('x^2-2xy+y^2', ['x', 'y'])), ['x^2', 'x^1*y^1', 'y^2']);
    assert.deepEqual(monomialSignatures(parseExpr('x/2+1', ['x'])), ['x^1', '1']);
    assert.equal(monomialSignatures(parseExpr('1/x', ['x'])), null);
  });
});
