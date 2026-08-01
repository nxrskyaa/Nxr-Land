import { describe, expect, it, vi } from 'vitest';
import { CharacterFactory, DEFAULT_APPEARANCE } from '../src/visuals/CharacterFactory.js';

function mesh(character, name) {
  return character.getObjectByName(name);
}

describe('CharacterFactory', () => {
  it('reuses cached geometry and stable color material variants without sharing hierarchies', () => {
    const factory = new CharacterFactory();
    const first = factory.create(DEFAULT_APPEARANCE);
    const second = factory.create({ ...DEFAULT_APPEARANCE });

    expect(first).not.toBe(second);
    expect(mesh(first, 'Head')).not.toBe(mesh(second, 'Head'));
    expect(mesh(first, 'Head').geometry).toBe(mesh(second, 'Head').geometry);
    expect(mesh(first, 'Head').material).toBe(mesh(second, 'Head').material);
    expect(mesh(first, 'Body').material).toBe(mesh(second, 'Body').material);
    factory.dispose();
  });

  it('updates appearance using cached resources and does not prematurely dispose shared variants', () => {
    const factory = new CharacterFactory();
    const character = factory.create(DEFAULT_APPEARANCE);
    const oldBody = mesh(character, 'Body');
    const oldMaterial = oldBody.material;
    const dispose = vi.spyOn(oldMaterial, 'dispose');

    const pondBlue = '#6ca7a5';
    factory.updateAppearance(character, { ...DEFAULT_APPEARANCE, top: pondBlue });
    expect(mesh(character, 'Body')).not.toBe(oldBody);
    expect(mesh(character, 'Body').material).not.toBe(oldMaterial);
    expect(character.userData.appearance.top).toBe(pondBlue);
    expect(dispose).not.toHaveBeenCalled();

    const second = factory.create({ ...DEFAULT_APPEARANCE, top: pondBlue });
    expect(mesh(second, 'Body').material).toBe(mesh(character, 'Body').material);
    factory.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('animates limbs in opposite phases and safely ignores missing characters', () => {
    const factory = new CharacterFactory();
    const character = factory.create();
    expect(() => factory.animate(null, 1, 2)).not.toThrow();
    factory.animate(character, 0.5, 3);
    const { leftLeg, rightLeg, leftArm, rightArm } = character.userData.parts;
    expect(leftLeg.rotation.x).toBeCloseTo(-rightLeg.rotation.x);
    expect(leftArm.rotation.x).toBeCloseTo(-leftLeg.rotation.x * 0.72);
    expect(rightArm.rotation.x).toBeCloseTo(leftLeg.rotation.x * 0.72);
    factory.dispose();
  });

  it('disposes every cached resource exactly once and is idempotent', () => {
    const factory = new CharacterFactory();
    const character = factory.create();
    const geometrySpies = Object.values(factory.geometries).map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...factory.materials.values()].map((material) => vi.spyOn(material, 'dispose'));

    factory.dispose();
    factory.dispose();
    geometrySpies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
    materialSpies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
    expect(character.children).toHaveLength(0);
    expect(() => factory.create()).toThrow(/disposed/i);
    expect(() => factory.updateAppearance(character, DEFAULT_APPEARANCE)).not.toThrow();
  });
});
