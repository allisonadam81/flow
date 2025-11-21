import { expect, test, describe, vi } from 'vitest';
import FlowBox from '../FlowBox';

const sleep = (t = 50) => {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  });
};

const addOne = (x) => x + 1;
const biggerThanTen = (x) => x > 10;

describe('FlowBox initialization', () => {
  test('FlowBox.of makes a thunk out of the value passed in.', () => {
    const box = FlowBox.of(5);
    expect(typeof box._thunk).toBe('function');
    expect(box.run()).toBe(5);
  });

  test('FlowBox.thunk stores the value passed in.', () => {
    const box = FlowBox.thunk(() => 6);
    expect(typeof box._thunk).toBe('function');
    expect(box.run()).toBe(6);
  });
});

describe('FlowBox.map', () => {
  test('Applies the callback to the value.', () => {
    const box = FlowBox.of(5);
    expect(box.map((x) => x + 1).run()).toBe(6);
  });

  test('Applies the callback to the value return by a promise if the thunk returns a promise.', async () => {
    const box = FlowBox.thunk(async () => {
      await sleep();
      return 5;
    });

    const val = box.map((x) => x + 1).run();
    expect(val).toBeInstanceOf(Promise);
    expect(await val).toBe(6);
  });
  test('Will not call the callback if a bad value is found.', async () => {
    const box = FlowBox.of(null);
    const mock = vi.fn();
    const val = box
      .map((x) => x + 1)
      .map(mock)
      .run();
    expect(mock).not.toHaveBeenCalled();
  });

  test('Will not call the callback if a promise resolves to a bad value', async () => {
    const box = FlowBox.thunk(async () => {
      await sleep();
      return undefined;
    });
    const mock = vi.fn();
    const val = box.map(addOne).map(mock).run();
    await val;
    expect(mock).not.toHaveBeenCalled();
  });

  test('Catches and returns sync errors', async () => {
    const box = FlowBox.thunk(() => {
      throw new Error('no way');
    });
    const mock = vi.fn();
    const val = box.map(addOne).map(mock).run();

    expect(mock).not.toHaveBeenCalled();
    expect(val.message).toBe('no way');
  });

  test('Catches and propagates async errors', async () => {
    const box = FlowBox.thunk(async () => {
      await sleep();
      throw new Error('no way');
    });
    const mock = vi.fn();
    const val = box.map(addOne).map(mock).run();
    try {
      const v = await val;
      console.log('v', v);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
    expect(mock).not.toHaveBeenCalled();
  });
});

describe('Flowbox.filter', () => {
  test('It returns null if the value does not pass the predicate', () => {
    const box = FlowBox.of(5).filter(biggerThanTen);
    expect(box.run()).toBe(null);
  });

  test('It returns the value if the value does pass the predicate', () => {
    const box = FlowBox.of(5).filter((x) => !biggerThanTen(x));
    expect(box.run()).toBe(5);
  });

  test('It calls the predicate on the resolved value of a promise, if the value is a promise.', async () => {
    const box = FlowBox.thunk(async () => {
      await sleep();
      return 12;
    }).filter(biggerThanTen);
    const val = box.run();
    expect(val).toBeInstanceOf(Promise);
    const v = await val;
    expect(v).toBe(12);
  });

  test('It calls the predicate on the resolved value of a promise, if the value is a promise.', async () => {
    const box = FlowBox.thunk(async () => {
      await sleep();
      return 12;
    }).filter(biggerThanTen);
    const val = box.run();
    expect(val).toBeInstanceOf(Promise);
    const v = await val;
    expect(v).toBe(12);
  });

  test('If the resolved promise has a bad value, it will not call the predicate', async () => {
    const mockFilter = vi.fn();
    const box = FlowBox.thunk(async () => {
      await sleep();
      return null;
    }).filter(mockFilter);
    const val = box.run();
    expect(val).toBeInstanceOf(Promise);
    const v = await val;
    expect(mockFilter).not.toHaveBeenCalled();
  });
});

describe('FlowBox.flatMap', () => {
  test('Calls the function on the value, and unwraps it if it is a flow box.', () => {
    const box = FlowBox.of(5).flatMap((x) => FlowBox.of(addOne(x)));
    expect(box.run()).toBe(6);
  });
  test('Calls the function on the value, and does not unpack if it is not a flowbox', () => {
    const box = FlowBox.of(5).flatMap(addOne);
    expect(box.run()).toBe(6);
  });

  test('Does not call the function on a bad value', () => {
    const mock = vi.fn();
    const box = FlowBox.of(null).flatMap(mock);
    box.run();
    expect(mock).not.toHaveBeenCalled();
  });

  test('Waits for promises to resolves before calling the function, and unpacks a FlowBox if it is returned', async () => {
    const box = FlowBox.thunk(async () => {
      await sleep();
      return 5;
    }).flatMap((x) => FlowBox.of(x + 1));
    expect(await box.run()).toBe(6);
  });

  test('Does not call function on bad values', async () => {
    const mock = vi.fn();
    const box = FlowBox.thunk(async () => {
      await sleep();
      return null;
    }).flatMap(mock);
    expect(await box.run()).toBeNull();
    expect(mock).not.toHaveBeenCalled();
  });

  test('If the resolved promise is a FlowBox, it will unpack the FlowBox', async () => {
    const box = FlowBox.thunk(async () => {
      await sleep();
      return 12;
    }).flatMap((x) => FlowBox.of(addOne(x)));
    const val = box.run();
    expect(val).toBeInstanceOf(Promise);
    const v = await val;
    expect(v).toBe(13);
  });
});

describe('FlowBox.distribute', () => {
  test('If you have a FlowBox with an array of values, some FlowBoxes some not, then you will get a FlowBox with an array of FlowBoxes', async () => {
    const box = FlowBox.of([1, FlowBox.of(2), 3]);
    const res = box.distribute().run();
    expect(res).toBeInstanceOf(Array);
    res.map((fb) => expect(fb).toBeInstanceOf(FlowBox));
    expect(res[1].run()).toBe(2);
  });

  test('If a FlowBox resolves to a promise, distribute the resolved value', async () => {
    const box = FlowBox.thunk(async () => [1, FlowBox.of(2), 3]);
    const res = box.distribute().run();
    // The result itself is a promise because the outer thunk is async
    expect(res).toBeInstanceOf(Promise);
    const resolved = await res;
    // All elements in the array should be FlowBoxes
    expect(resolved).toBeInstanceOf(Array);
    resolved.forEach((fb) => expect(fb).toBeInstanceOf(FlowBox));

    // Running the second element should give 2
    expect(await resolved[1].run()).toBe(2);

    // Check other elements
    expect(await resolved[0].run()).toBe(1);
    expect(await resolved[2].run()).toBe(3);
  });
});

describe('FlowBox.flat', () => {
  test('It should flatten if the value is a FlowBox.', () => {
    const box = FlowBox.of(FlowBox.of(5));
    expect(box.flat().run()).toBe(5);
  });
  test('It should not flatten if the value is not a FlowBox', () => {
    const box = FlowBox.of(5);
    expect(box.flat().run()).toBe(5);
  });
  test('If the value is a promise, it flattens the resolved value.', async () => {
    const box = FlowBox.thunk(async () => FlowBox.of(5));
    expect(await box.flat().run()).toBe(5);
  });
});

describe('FlowBox.traverse', () => {
  test('It should apply a callback to an array of values, unpack any that are FlowBoxes, and return an array of results.', () => {
    const box = FlowBox.of([1, 2, FlowBox.of(3)]);
    const res = box.traverse(addOne);
    expect(res.run()).toEqual([2, 3, 4]);
  });
});
