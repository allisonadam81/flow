import { expect, test, describe, vi } from 'vitest';
import FlowBox, { defaultConfig } from '../FlowBox';

const sleep = (t = 50) => {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  });
};

const addOne = (x) => {
  return x + 1;
};
const biggerThanTen = (x) => x > 10;
describe('FlowBox', () => {
  describe('FlowBox initialization - FlowBox.of, FlowBox.thunk', () => {
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

  describe('FlowBox.filter', () => {
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

    test('It should apply a callback to an array of values, apply the callback to any promises on the resolved values', async () => {
      const box = FlowBox.of([1, 2, FlowBox.thunk(async () => 3)]);
      const res = box.traverse(addOne);
      expect(await Promise.all(res.run())).toEqual([2, 3, 4]);
    });

    test('It should not call the callback on any bad values in a collection.', async () => {
      const box = FlowBox.of([null, undefined, NaN]);
      const fn = vi.fn();
      const traversed = box.traverse(fn);
      expect(await Promise.all(traversed.run())).toEqual([
        null,
        undefined,
        NaN,
      ]);
      expect(fn).not.toHaveBeenCalled();
    });
    test('It should not call the callback if the value is a bad value.', async () => {
      const box = FlowBox.of(null);
      const fn = vi.fn();
      const traversed = box.traverse(fn);
      expect(traversed.run()).toBeNull();
      expect(fn).not.toHaveBeenCalled();
    });

    test('if value is a promise, then it should call the function on the resolved value.', async () => {
      const box = FlowBox.thunk(async () => {
        await sleep();
        return [1, 2, FlowBox.of(3)];
      });
      const res = box.traverse(addOne);
      expect(await res.run()).toEqual([2, 3, 4]);
    });

    test('If any values in a collection resolve to a promise, it should call the callback on the resolved value of that promise.', async () => {
      const box = FlowBox.thunk(async () => {
        await sleep();
        return [1, 2, FlowBox.of(Promise.resolve(3))];
      });
      const res = box.traverse(addOne);
      const secondLvl = await res.run();
      expect(await Promise.all(secondLvl)).toEqual([2, 3, 4]);
    });

    test('If value is a promise, and If any values resolve to a promise, it will not call the callback if that promise resolves to a bad value.', async () => {
      const box = FlowBox.thunk(async () => {
        await sleep();
        return [1, 2, FlowBox.of(Promise.resolve(null))];
      });
      const fn = vi.fn();
      const traversed = box.traverse(fn);
      const resProm = await traversed.run();
      const all = await Promise.all(resProm);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('If vaue is not a promise, and any values resolve to a promise, it will not call the callback if that promise resolves to a bad value.', async () => {
      const box = FlowBox.thunk(() => {
        return [1, 2, FlowBox.of(Promise.resolve(null))];
      });
      const fn = vi.fn();
      const traversed = box.traverse(fn);
      const resProm = traversed.run();
      const all = await Promise.all(resProm);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('FlowBox.toPromiseAll', () => {
    test('It should convert all promises into a promise.all', async () => {
      const box = FlowBox.of([1, 2, Promise.resolve(3)]);
      const res = await box.toPromiseAll().run();
      expect(res).toEqual([1, 2, 3]);
    });

    test('If the value is already a promise, it will wait for the promise to resolve and convert that result into a Promise.all', async () => {
      const box = FlowBox.thunk(async () => [1, 2, Promise.resolve(3)]);
      const res = await box.toPromiseAll().run();
      expect(res).toEqual([1, 2, 3]);
    });
    test('If the value is already a promise, it will wait for the promise to resolve and if not a bad value, convert that result into a Promise.all', async () => {
      const box = FlowBox.thunk(async () => null);
      const res = await box.toPromiseAll().run();
      // this means it's not an array, so the promise.all was not called.
      expect(res).toBeNull();
    });
  });

  describe('FlowBox.sequence', () => {
    test('It should unpack all nested FlowBoxes in an array of FlowBoxes', () => {
      const box = FlowBox.of([FlowBox.of(1), FlowBox.of(2), FlowBox.of(3)]);
      expect(box.sequence().run()).toEqual([1, 2, 3]);

      box
        .sequence()
        .peak((v) => {
          expect(v).toEqual([1, 2, 3]);
        })
        .run();
    });

    test('It should not unpack regular values', () => {
      const box = FlowBox.of([FlowBox.of(1), 2, FlowBox.of(3)]);
      expect(box.sequence().run()).toEqual([1, 2, 3]);

      box
        .sequence()
        .peak((v) => {
          expect(v).toEqual([1, 2, 3]);
        })
        .run();
    });

    test('It sequences if the value is a promise once the promise resolves.', async () => {
      const box = FlowBox.thunk(async () => [FlowBox.of(1), 2, FlowBox.of(3)]);
      const res = await box
        .sequence()
        .peak(async (v) => {
          const val = await v;
          expect(val).toEqual([1, 2, 3]);
        })
        .run();
      expect(res).toEqual([1, 2, 3]);
    });

    test('It sequences after all promises are resolved, and unpacks any FlowBoxes returned from promises.', async () => {
      const box = FlowBox.thunk(async () => [
        FlowBox.of(1),
        2,
        Promise.resolve(FlowBox.of(3)),
      ]);
      const res = await box
        .sequence()
        .peak(async (v) => {
          const val = await v;
          expect(val[0]).toBe(1);
          expect(val[1]).toBe(2);
          expect(val[2]).toBeInstanceOf(Promise);
        })
        .toPromiseAll()
        .peak(async (v) => {
          const val = await v;
          expect(val).toEqual([1, 2, 3]);
        })
        .run();
      expect(res).toEqual([1, 2, 3]);
    });
  });

  describe('FlowBox.ap', () => {
    test('It should apply a function to another boxes value', () => {
      const box = FlowBox.of((x) => x + 1);
      const valBox = FlowBox.of(2);
      expect(box.ap(valBox).run()).toBe(3);
    });
    test('It should apply a function to a plain value.', () => {
      const box = FlowBox.of((x) => x + 1);
      const valBox = 2;
      expect(box.ap(valBox).run()).toBe(3);
    });

    test('It should not apply a bad value to a function, and should return the bad value.', () => {
      const mock = vi.fn();
      const box = FlowBox.of(mock);
      const valBox = null;
      expect(
        box
          .ap(valBox)
          .peak((val) => {
            expect(val).toBeNull();
          })
          .run()
      ).toBe(null);
      expect(mock).not.toHaveBeenCalled();
    });

    test('It should not do anything if the first box is a bad value.', () => {
      const box = FlowBox.of(null);
      const valBox = 1;
      expect(
        box
          .ap(valBox)
          .peak((val) => {
            expect(val).toBeNull();
          })
          .run()
      ).toBe(null);
    });

    test('If first box is a promise, it will wait to be resolved before applying the function.', async () => {
      const box = FlowBox.thunk(async () => (x) => x + 1);
      const valBox = 1;
      const res = await box.ap(valBox).run();
      expect(res).toBe(2);
    });

    test('If second box is a promise, it will wait to be resolved before applying the function.', async () => {
      const box = FlowBox.of((x) => x + 1);
      const valBox = FlowBox.thunk(async () => 3);
      const res = box.ap(valBox).run();
      expect(res).toBeInstanceOf(Promise);
      const v = await res;
      expect(v).toBe(4);
    });

    test('If both boxes are promises, it will wait for both before calling any functions.', async () => {
      const box = FlowBox.thunk(async () => (x) => x + 1);
      const valBox = FlowBox.thunk(async () => 3);
      const res = box.ap(valBox).run();
      expect(res).toBeInstanceOf(Promise);
      const v = await res;
      expect(v).toBe(4);
    });
    test('If will handle bad value if first promise resolves to a bad value.', async () => {
      const box = FlowBox.thunk(async () => null);
      const valBox = FlowBox.thunk(async () => 3);
      const res = box.ap(valBox).run();
      expect(res).toBeInstanceOf(Promise);
      const v = await res;
      expect(v).toBeNull();
    });

    test('If will handle bad value if second promise resolves to a bad value.', async () => {
      const box = FlowBox.thunk(async () => (x) => x + 1);
      const valBox = FlowBox.thunk(async () => NaN);
      const res = box.ap(valBox).run();
      expect(res).toBeInstanceOf(Promise);
      const v = await res;
      expect(v).toBe(NaN);
    });
  });

  describe('FlowBox.catch', () => {
    test('Should catch run time errors and correct them', () => {
      const box = FlowBox.of(1);
      const res = box
        .map((x) => {
          throw new Error('nah');
        })
        .peak((val) => {
          expect(val).toBeInstanceOf(Error);
        })
        .catch((e) => {
          return 2;
        })
        .run();
      expect(res).toBe(2);
    });
    test('Should catch promises and recover them.', async () => {
      const box = FlowBox.thunk(async () => 1);
      const res = await box
        .map((x) => {
          throw new Error('nah');
        })
        .peak((val) => {
          expect(val).toBeInstanceOf(Promise);
        })
        .catch((e) => {
          return 2;
        })
        .run();
      expect(res).toBe(2);
    });
  });

  describe('FlowBox.collect', () => {
    test('It should run the chain, and return a new FlowBox - should work with of', async () => {
      const box = FlowBox.of(5);
      const res = box.map(addOne).collect();
      expect(res.value).toBe(6);
    });
    test('It should run the chain, and return a new FlowBox - should work with thunk', async () => {
      const box = FlowBox.thunk(() => 5);
      const res = box.map(addOne).collect();
      expect(res.value).toBe(6);
    });
  });

  describe('FlowBox configs', () => {
    test('It should generate with default values', async () => {
      const box = FlowBox.of(5);
      expect(box.config).toEqual(defaultConfig);
    });
    test('It should propogate the config to all children later in the pipeline.', async () => {
      const box = FlowBox.of(5);
      const res = box
        .map(addOne)
        .tap((t) => {
          expect(t.config).toEqual(defaultConfig);
        })
        .withConfig({ badValues: [1, 2, 3] })
        .tap((t) => {
          expect(t.config).toEqual({ badValues: [1, 2, 3] });
        })
        .map(addOne)
        .tap((t) => {
          expect(t.config).toEqual({ badValues: [1, 2, 3] });
        });
      expect(res.run()).toBe(7);
      // expect(res.config).toEqual(defaultConfig);
    });
  });
});
