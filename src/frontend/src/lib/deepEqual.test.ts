import { describe, it, expect } from "vitest";
import { deepEqual } from "./deepEqual";

describe("deepEqual", () => {
  // Primitives
  it("returns true for identical numbers", () => {
    expect(deepEqual(1, 1)).toBe(true);
  });

  it("returns false for different numbers", () => {
    expect(deepEqual(1, 2)).toBe(false);
  });

  it("returns true for identical strings", () => {
    expect(deepEqual("a", "a")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(deepEqual("a", "b")).toBe(false);
  });

  it("returns true for both null", () => {
    expect(deepEqual(null, null)).toBe(true);
  });

  it("returns true for both undefined", () => {
    expect(deepEqual(undefined, undefined)).toBe(true);
  });

  it("returns false for null vs undefined", () => {
    expect(deepEqual(null, undefined)).toBe(false);
  });

  it("returns true for both true", () => {
    expect(deepEqual(true, true)).toBe(true);
  });

  it("returns false for true vs false", () => {
    expect(deepEqual(true, false)).toBe(false);
  });

  // Arrays
  it("returns true for identical arrays", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it("returns false for arrays of different length", () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it("returns false for arrays with different values", () => {
    expect(deepEqual([1, 2], [1, 3])).toBe(false);
  });

  it("returns true for empty arrays", () => {
    expect(deepEqual([], [])).toBe(true);
  });

  it("returns true for nested arrays", () => {
    expect(deepEqual([[1, 2], [3]], [[1, 2], [3]])).toBe(true);
  });

  // Objects
  it("returns true for identical objects", () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  it("returns true for objects with different key order", () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("returns false for objects with different values", () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("returns false for objects with different keys", () => {
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it("returns false for objects with different key counts", () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("returns true for empty objects", () => {
    expect(deepEqual({}, {})).toBe(true);
  });

  // Nested objects
  it("returns true for deeply nested equal objects", () => {
    const a = { x: { y: { z: [1, 2] } } };
    const b = { x: { y: { z: [1, 2] } } };
    expect(deepEqual(a, b)).toBe(true);
  });

  it("returns false for deeply nested different objects", () => {
    const a = { x: { y: { z: [1, 2] } } };
    const b = { x: { y: { z: [1, 3] } } };
    expect(deepEqual(a, b)).toBe(false);
  });

  // Type mismatches
  it("returns false for array vs object", () => {
    expect(deepEqual([], {})).toBe(false);
  });

  it("returns false for object vs null", () => {
    expect(deepEqual({}, null)).toBe(false);
  });

  it("returns false for number vs string", () => {
    expect(deepEqual(1, "1")).toBe(false);
  });

  // Same reference
  it("returns true for same reference", () => {
    const obj = { a: 1 };
    expect(deepEqual(obj, obj)).toBe(true);
  });
});
