/**
 * Safe monetary arithmetic utilities to prevent IEEE 754 floating-point drift.
 * All amounts in INR are represented with strict 2-decimal precision (paise).
 */

export const toPaise = (amount: number): number => {
  return Math.round((Number(amount) || 0) * 100);
};

export const fromPaise = (paise: number): number => {
  return Math.round(paise) / 100;
};

export const roundMoney = (amount: number): number => {
  return fromPaise(toPaise(amount));
};

export const addMoney = (a: number, b: number): number => {
  return fromPaise(toPaise(a) + toPaise(b));
};

export const subtractMoney = (a: number, b: number): number => {
  return fromPaise(toPaise(a) - toPaise(b));
};

export const multiplyMoney = (amount: number, factor: number): number => {
  return fromPaise(Math.round(toPaise(amount) * factor));
};
