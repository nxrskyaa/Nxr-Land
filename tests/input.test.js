/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Input, normalizeInputVector, joystickVector } from '../src/game/Input.js';

describe('input vectors', () => {
  it('normalizes diagonal digital input without accelerating it', () => {
    expect(normalizeInputVector(1, 0)).toEqual({ x: 1, z: 0 });
    const diagonal = normalizeInputVector(1, 1);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1);
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2);
  });

  it('guards invalid values and applies a joystick dead zone', () => {
    expect(normalizeInputVector(Number.NaN, 2)).toEqual({ x: 0, z: 1 });
    expect(joystickVector(0.5, 0.5, 5, 0.2)).toEqual({ x: 0, z: 0 });
    const analog = joystickVector(10, 0, 20, 0.2);
    expect(analog.x).toBeCloseTo(0.375);
    expect(analog.z).toBe(0);
    expect(Math.hypot(...Object.values(joystickVector(40, 40, 20)))).toBeCloseTo(1);
  });
});

function pointer(target, type, options = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.entries({
    pointerId: 1,
    pointerType: 'touch',
    clientX: 20,
    clientY: 30,
    button: 0,
    isPrimary: true,
    ...options,
  }).forEach(([key, value]) => Object.defineProperty(event, key, { value }));
  target.dispatchEvent(event);
  return event;
}

function key(target, type, code, options = {}) {
  target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, code, ...options }));
}

function setup() {
  document.body.innerHTML = '<main id="game"><canvas></canvas><input /></main>';
  const container = document.querySelector('#game');
  const canvas = container.querySelector('canvas');
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.hasPointerCapture = vi.fn(() => true);
  const onAction = vi.fn();
  const screenToWorld = vi.fn((x, y) => ({ x: x / 10, z: y / 10 }));
  const input = new Input({ canvas, container, onAction, screenToWorld });
  input.setEnabled(true);
  return { input, container, canvas, onAction, screenToWorld, textInput: container.querySelector('input') };
}

beforeEach(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

describe('Input DOM behavior', () => {
  it('suppresses game keys while typing and normalizes keyboard movement', () => {
    const { input, textInput } = setup();
    key(textInput, 'keydown', 'KeyW');
    expect(input.getVector()).toEqual({ x: 0, z: 0 });

    key(window, 'keydown', 'KeyW');
    key(window, 'keydown', 'KeyD');
    const movement = input.getVector();
    expect(movement.x).toBeCloseTo(Math.SQRT1_2);
    expect(movement.z).toBeCloseTo(-Math.SQRT1_2);
    key(window, 'keyup', 'KeyW');
    key(window, 'keyup', 'KeyD');
    input.dispose();
  });

  it('fires actions once for non-repeating keyboard presses', () => {
    const { input, onAction } = setup();
    key(window, 'keydown', 'Space');
    key(window, 'keydown', 'Space', { repeat: true });
    key(window, 'keydown', 'KeyE');
    expect(onAction).toHaveBeenCalledTimes(2);
    input.dispose();
  });

  it('clears target and movement on blur, visibility loss, and disable', () => {
    const { input } = setup();
    input.target = { x: 4, z: 5 };
    key(window, 'keydown', 'KeyW');
    window.dispatchEvent(new Event('blur'));
    expect(input.target).toBeNull();
    expect(input.getVector()).toEqual({ x: 0, z: 0 });

    input.target = { x: 4, z: 5 };
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(input.target).toBeNull();

    input.target = { x: 4, z: 5 };
    input.setEnabled(false);
    expect(input.target).toBeNull();
    input.dispose();
  });

  it.each(['mouse', 'touch', 'pen'])('sets a canvas target from a short %s tap', (pointerType) => {
    const { input, canvas, screenToWorld } = setup();
    pointer(canvas, 'pointerdown', { pointerId: 7, pointerType, clientX: 40, clientY: 50 });
    pointer(canvas, 'pointerup', { pointerId: 7, pointerType, clientX: 46, clientY: 55 });
    expect(screenToWorld).toHaveBeenCalledWith(46, 55);
    expect(input.target).toEqual({ x: 4.6, z: 5.5 });
    input.dispose();
  });

  it('does not set a target after a canvas drag', () => {
    const { input, canvas, screenToWorld } = setup();
    pointer(canvas, 'pointerdown', { pointerId: 3, clientX: 10, clientY: 10 });
    pointer(canvas, 'pointermove', { pointerId: 3, clientX: 30, clientY: 10 });
    pointer(canvas, 'pointerup', { pointerId: 3, clientX: 30, clientY: 10 });
    expect(screenToWorld).not.toHaveBeenCalled();
    expect(input.target).toBeNull();
    input.dispose();
  });

  it('drives, cancels, and safely releases the joystick pointer', () => {
    const { input } = setup();
    input.joystick.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
    input.joystick.setPointerCapture = vi.fn();
    input.joystick.releasePointerCapture = vi.fn();
    input.joystick.hasPointerCapture = vi.fn(() => true);

    pointer(input.joystick, 'pointerdown', { pointerId: 11, clientX: 100, clientY: 50 });
    expect(input.mobileVector.x).toBeGreaterThan(0);
    pointer(input.joystick, 'pointercancel', { pointerId: 11, clientX: 100, clientY: 50 });
    expect(input.mobileVector).toEqual({ x: 0, z: 0 });
    expect(input.joystick.releasePointerCapture).toHaveBeenCalledWith(11);
    expect(input.knob.style.transform).toBe('');
    input.dispose();
  });

  it('supports touch action and idempotent disposal without lingering controls/listeners', () => {
    const { input, container, onAction } = setup();
    const action = container.querySelector('.action-button');
    pointer(action, 'pointerdown', { pointerId: 9 });
    expect(onAction).toHaveBeenCalledOnce();

    input.dispose();
    input.dispose();
    expect(container.querySelector('.mobile-controls')).toBeNull();
    key(window, 'keydown', 'KeyE');
    expect(onAction).toHaveBeenCalledOnce();
  });
});
