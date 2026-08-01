import { describe, expect, it, vi } from 'vitest';
import { CROPS } from '../src/data/crops.js';
import { Crop } from '../src/entities/Crop.js';
import { CropFactory } from '../src/visuals/CropFactory.js';

const position = { x: 2, y: 0.3, z: 4 };

describe('CropFactory and Crop visuals', () => {
  it('creates six distinct catalog-driven ripe silhouettes with shared cached resources', () => {
    const factory = new CropFactory();
    const crops = CROPS.map((definition) => factory.create({ plotId: definition.id, cropId: definition.id, stageIndex: definition.stages.length - 1, state: 'harvestable', position }));
    expect(new Set(crops.map((crop) => crop.root.userData.form)).size).toBe(6);
    expect(crops.every((crop) => crop.root.getObjectByName('Crop plant'))).toBe(true);
    expect(factory.geometries.size).toBeGreaterThan(0);
    expect(factory.materials.size).toBeGreaterThan(0);
    factory.dispose();
  });

  it('maps reload state to stage and moisture feedback and supports idle sway', () => {
    const factory = new CropFactory();
    const crop = factory.create({ plotId: 'home-plot-1', cropId: 'turnip', stageIndex: 1, state: 'watered', position });
    expect(crop).toBeInstanceOf(Crop);
    expect(crop.root.userData.stageIndex).toBe(1);
    expect(crop.soil.material.color.getHexString()).toBe(factory.colors.moistSoil.replace('#', ''));
    const before = crop.plant.rotation.z;
    factory.update(0.1, 2);
    expect(crop.plant.rotation.z).not.toBe(before);
    factory.sync(crop, { cropId: 'turnip', stageIndex: 3, state: 'harvestable' });
    expect(crop.root.userData.stageIndex).toBe(3);
    factory.dispose();
  });

  it('creates a bounded harvest particle burst and expires it during updates', () => {
    const factory = new CropFactory({ reducedMotion: false });
    const burst = factory.burstHarvest(position, '#ffcc55');
    expect(burst.children.length).toBeGreaterThan(3);
    expect(burst.children.length).toBeLessThanOrEqual(12);
    factory.update(1, 1);
    expect(burst.parent).toBeNull();
    factory.dispose();
  });

  it('disposes shared resources and crop hierarchies exactly once', () => {
    const factory = new CropFactory();
    const crop = factory.create({ plotId: 'home-plot-1', cropId: 'pumpkin', stageIndex: 4, state: 'harvestable', position });
    const geometrySpies = [...factory.geometries.values()].map((entry) => vi.spyOn(entry, 'dispose'));
    const materialSpies = [...factory.materials.values()].map((entry) => vi.spyOn(entry, 'dispose'));
    factory.dispose(); factory.dispose(); crop.dispose(); crop.dispose();
    geometrySpies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
    materialSpies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
    expect(crop.root).toBeNull();
  });
});
