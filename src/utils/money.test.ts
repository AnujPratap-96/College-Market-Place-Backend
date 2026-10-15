import { describe, it, expect } from 'vitest';
import {
  toPaise,
  fromPaise,
  roundMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
} from './money';

describe('Monetary Arithmetic Utility (Precision & Float Drift Hardening)', () => {
  it('correctly converts INR float to integer paise without drift', () => {
    expect(toPaise(100.5)).toBe(10050);
    expect(toPaise(0.1)).toBe(10);
    expect(toPaise(0.2)).toBe(20);
    expect(toPaise(49.99)).toBe(4999);
    expect(toPaise(0)).toBe(0);
  });

  it('correctly converts integer paise back to INR float', () => {
    expect(fromPaise(10050)).toBe(100.5);
    expect(fromPaise(10)).toBe(0.1);
    expect(fromPaise(20)).toBe(0.2);
    expect(fromPaise(4999)).toBe(49.99);
  });

  it('eliminates IEEE 754 float drift in addition (0.1 + 0.2)', () => {
    // In native JS: 0.1 + 0.2 === 0.30000000000000004
    expect(0.1 + 0.2).not.toBe(0.3);
    // With addMoney:
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(addMoney(19.99, 10.01)).toBe(30.0);
  });

  it('eliminates IEEE 754 float drift in subtraction', () => {
    // In native JS: 100 - 99.95 === 0.05000000000000426
    expect(100 - 99.95).not.toBe(0.05);
    // With subtractMoney:
    expect(subtractMoney(100, 99.95)).toBe(0.05);
    expect(subtractMoney(50.0, 50.0)).toBe(0);
  });

  it('multiplies monetary amounts cleanly with rounding', () => {
    expect(multiplyMoney(100, 0.05)).toBe(5.0); // 5% fee
    expect(multiplyMoney(49.99, 3)).toBe(149.97);
  });

  it('rounds amounts cleanly to 2 decimal places', () => {
    expect(roundMoney(45.555)).toBe(45.56);
    expect(roundMoney(12.341)).toBe(12.34);
  });
});
