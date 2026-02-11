import { describe, it, expect } from 'vitest';
import {
  A_DRIVER_KEYS,
  A_DRIVER_WEIGHTS,
  A_DRIVER_LABELS,
  B_LAYER1_KEYS,
  B_LAYER1_LABELS,
  B_LAYER2_KEYS,
  B_LAYER2_LABELS,
  MECHANISM_MODIFIERS,
  MECHANISM_LABELS,
} from '@/lib/types';

describe('A_DRIVER_WEIGHTS', () => {
  it('has exactly 7 drivers', () => {
    expect(A_DRIVER_KEYS).toHaveLength(7);
  });

  it('weights sum to 1.0', () => {
    const sum = Object.values(A_DRIVER_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('all drivers have labels', () => {
    for (const key of A_DRIVER_KEYS) {
      expect(A_DRIVER_LABELS[key]).toBeDefined();
      expect(A_DRIVER_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it('all drivers have positive weights', () => {
    for (const key of A_DRIVER_KEYS) {
      expect(A_DRIVER_WEIGHTS[key]).toBeGreaterThan(0);
    }
  });

  it('election has the highest weight (0.22)', () => {
    expect(A_DRIVER_WEIGHTS.election).toBe(0.22);
    for (const key of A_DRIVER_KEYS) {
      expect(A_DRIVER_WEIGHTS.election).toBeGreaterThanOrEqual(A_DRIVER_WEIGHTS[key]);
    }
  });
});

describe('B-Score keys and labels', () => {
  it('has exactly 4 Layer 1 keys', () => {
    expect(B_LAYER1_KEYS).toHaveLength(4);
  });

  it('has exactly 4 Layer 2 keys', () => {
    expect(B_LAYER2_KEYS).toHaveLength(4);
  });

  it('all Layer 1 keys have labels', () => {
    for (const key of B_LAYER1_KEYS) {
      expect(B_LAYER1_LABELS[key]).toBeDefined();
    }
  });

  it('all Layer 2 keys have labels', () => {
    for (const key of B_LAYER2_KEYS) {
      expect(B_LAYER2_LABELS[key]).toBeDefined();
    }
  });
});

describe('MECHANISM_MODIFIERS', () => {
  it('has 8 mechanisms', () => {
    expect(Object.keys(MECHANISM_MODIFIERS)).toHaveLength(8);
  });

  it('all modifiers are in range 0.90-1.15', () => {
    for (const val of Object.values(MECHANISM_MODIFIERS)) {
      expect(val).toBeGreaterThanOrEqual(0.90);
      expect(val).toBeLessThanOrEqual(1.15);
    }
  });

  it('all mechanisms have labels', () => {
    for (const key of Object.keys(MECHANISM_MODIFIERS)) {
      expect(MECHANISM_LABELS[key as keyof typeof MECHANISM_LABELS]).toBeDefined();
    }
  });

  it('election_admin_change has the highest modifier', () => {
    expect(MECHANISM_MODIFIERS.election_admin_change).toBe(1.15);
  });

  it('norm_erosion_only has the lowest modifier', () => {
    expect(MECHANISM_MODIFIERS.norm_erosion_only).toBe(0.90);
  });
});
