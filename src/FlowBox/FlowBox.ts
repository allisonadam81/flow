import {
  fromEntries,
  toEntries,
  identity,
  invoke,
  isError,
  isFunction,
  isPromise,
  head,
} from '../utils';

type BadValuePredicate = (v: any) => boolean;
type BadValue = any | BadValuePredicate;
type Thunk<T> = () => T;

type MaybePromise<T> = T | Promise<T>;

type FlowBoxConfig = {
  badValues: BadValue[];
};

type MaybeFlowBox<U = any> = U | FlowBox<U>;

export const defaultConfig = Object.freeze({
  badValues: [null, undefined, isError, Number.isNaN],
});

class FlowBox<T> {
  private _thunk: Thunk<T>;
  private _config: FlowBoxConfig;

  // Static level configs.
  private static _defaultConfig: FlowBoxConfig = defaultConfig;

  /**
   * Defines a new default configuration for all FlowBox instances.
   * Merges the provided config with the existing default configuration.
   *
   * @param {FlowBoxConfig} newConfig - Configuration overrides.
   *
   * @example
   * FlowBox.defineConfig({ badValues: [null, undefined, 0] });
   * ^^ now this will be returned by an instance calling restoreDefaults().
   */
  static defineConfig(newConfig: FlowBoxConfig) {
    this._defaultConfig = Object.freeze({
      ...this._defaultConfig,
      ...newConfig,
    });
  }

  /**
   * Restores the FlowBox default configuration to the original defaults.
   *
   * @example
   * FlowBox.restoreDefaults();
   */
  static restoreDefaults() {
    this._defaultConfig = defaultConfig;
  }

  private static isBadValue<U>(v: U, badValues: BadValue[]) {
    const badVals = badValues || [];
    return badVals.some((bv) => {
      if (v === bv) return true;
      if (isFunction(bv) && bv(v)) return true;
      return false;
    });
  }

  // static instantiation methods and helpers.
  /**
   * Creates a FlowBox containing a plain value. Plain values will be wrapped in a thunk.
   *
   * @template U The type of the contained value.
   * @param {U} v - The value to wrap in a FlowBox.
   * @param {FlowBoxConfig} [c] - Optional configuration. Uses the default if omitted.
   * @returns {FlowBox<U>} A new FlowBox containing the value.
   *
   * @example
   * const box = FlowBox.of(42);
   * box.run(); // 42
   */
  static of<U>(v: U, c?: FlowBoxConfig): FlowBox<U> {
    return new FlowBox<U>(() => v, c || FlowBox._defaultConfig);
  }

  /**
   * Creates a FlowBox from a thunk (function that produces a value). Do this when you are already wrapping the value yourself.
   *
   *
   * @template U The type of the value produced by the thunk.
   * @param {Thunk<U>} t - A function that returns a value or promise.
   * @param {FlowBoxConfig} [c] - Optional configuration. Uses the default if omitted.
   * @returns {FlowBox<U>} A new FlowBox that will lazily evaluate the thunk.
   *
   * @example
   * const box = FlowBox.thunk(() => 5);
   * box.run(); // 5
   *
   * // Works with async functions
   * const asyncBox = FlowBox.thunk(async () => 42);
   * await asyncBox.run(); // 42
   */
  static thunk<U>(t: Thunk<U>, c?: FlowBoxConfig): FlowBox<U> {
    return new FlowBox(t, c || FlowBox._defaultConfig);
  }

  /**
   * Checks if a value is a FlowBox instance.
   *
   * @param {any} v - The value to check.
   * @returns {boolean} `true` if the value is a FlowBox, otherwise `false`.
   *
   * @example
   * const box = FlowBox.of(42);
   * FlowBox.isFlowBox(box); // true
   * FlowBox.isFlowBox(42);  // false
   */
  static isFlowBox(v: any): v is FlowBox<any> {
    return v instanceof FlowBox;
  }

  private static _unbox(v: any) {
    if (FlowBox.isFlowBox(v)) return v.value;
    if (isPromise(v)) return v.then(FlowBox._unbox);
    return v;
  }

  private static _unboxDeep(v: any): any {
    if (FlowBox.isFlowBox(v)) return FlowBox._unboxDeep(v.value);
    if (isPromise(v)) return v.then(FlowBox._unboxDeep);
    return v;
  }

  static resolve(
    val: any,
    onOk: any,
    isBadValue: any,
    onError = identity,
    onBad = identity
  ) {
    try {
      if (isPromise(val))
        return val.then((res: any) =>
          isBadValue(res) ? onBad(res) : onOk(res)
        );
      if (isBadValue(val)) return onBad(val);
      return onOk(val);
    } catch (err) {
      return onError(err);
    }
  }

  // Constructor and instance config.
  constructor(_thunk: Thunk<T>, _config = FlowBox._defaultConfig) {
    this._thunk = _thunk;
    this._config = _config;
  }

  private _thunkWithConfig<U>(thunk: Thunk<U>) {
    return FlowBox.thunk<U>(thunk, this.config);
  }

  private _ofWithConfig<U>(value: U) {
    return FlowBox.of<U>(value, this.config);
  }

  private get value(): T {
    return this._thunk();
  }

  /**
   * Returns the FlowBox's configuration.
   *
   * @returns {FlowBoxConfig} The configuration object for this FlowBox instance.
   */
  get config(): FlowBoxConfig {
    return this._config;
  }

  _isBadValue<U>(v: U): boolean {
    return FlowBox.isBadValue(v, this.config.badValues);
  }

  _resolve(val: any, onOk: any, onError = identity, onBad = identity) {
    return FlowBox.resolve(
      val,
      onOk,
      this._isBadValue.bind(this),
      onError,
      onBad
    );
  }

  /**
   * Returns a new FlowBox with the same value but a merged configuration.
   * Useful for customizing bad values or other settings.
   *
   * @param {Partial<FlowBoxConfig>} newConfig - Configuration overrides.
   * @returns {FlowBox<T>} A new FlowBox instance with the updated configuration.
   *
   * @example
   * const box = FlowBox.of(5);
   * const newBox = box.map(x => x + 1)
   *                    .withConfig({ badValues: [undefined] }) // the config now propagates for the rest of the chain.
   *                    .map(x => x - 1)
   */
  withConfig(newConfig: Partial<typeof defaultConfig>): FlowBox<T> {
    return FlowBox.thunk<T>(this._thunk, { ...this.config, ...newConfig });
  }

  /**
   * Returns a new FlowBox with the default configuration.
   *
   * @returns {FlowBox<T>} A new FlowBox instance with the default settings restored.
   *
   * @example
   * const box = FlowBox.of(5);
   * const newBox = box.map(x => x + 1)
   *                    .restoreDefaults()// the config now propagates for the rest of the chain.
   *                    .map(x => x - 1)
   */
  restoreDefaults(): FlowBox<T> {
    return FlowBox.thunk<T>(this._thunk, FlowBox._defaultConfig);
  }

  // Instance level Combinators

  /**
   * Applies a function to the contained value.
   *
   * Unlike `map`, `mutate` does not wrap the return value in `_resolve`.
   * Useful for side-effects or operations that may throw asynchronously, or in situations where you cannot avoiding having direct access to the raw value.
   *
   * @template U The type of the result of the function.
   * @param {(val: T) => MaybePromise<U>} fn - Function to apply to the contained value.
   * @returns {FlowBox<MaybePromise<U>>} A new FlowBox containing the function's result.
   *
   * @example
   * const box = FlowBox.of(5);
   * const newBox = box.mutate(async x => x + 1);
   * await newBox.run(); // 6
   */
  mutate<U = any>(fn: (v: T) => U) {
    return this._thunkWithConfig<U>(() => {
      try {
        const val = this.value;
        return fn(val);
      } catch (err) {
        return err as any;
      }
    });
  }

  /**
   * Applies a function to the value inside the FlowBox.
   *
   * Automatically resolves promises and propagates errors or "bad values" according
   * to the FlowBox configuration. If the function returns a promise, the resulting
   * FlowBox will contain that promise.
   *
   * @template U The type of the value returned by the callback.
   * @param {(val: T) => U | Promise<U>} fn - A function to transform the value.
   * @returns {FlowBox<U | Promise<U>>} A new FlowBox containing the transformed value.
   *
   * @example
   * const box = FlowBox.of(5);
   * const result = box.map(x => x + 1).run(); // 6
   *
   * const asyncBox = FlowBox.thunk(async () => 5); // Promise resolving to 5
   * const result = await asyncBox.map(async x => x + 1).run(); // Promise resolving to 6
   */
  map<U = any>(fn: (val: T) => U) {
    return this._thunkWithConfig<U>(() => {
      return this._resolve(this.value, fn);
    });
  }

  /**
   * Filters the contained value according to a predicate function.
   *
   * If the predicate returns false (or resolves to false in case of a promise),
   * the FlowBox will contain `null`. Promises returned by the predicate are supported.
   *
   * @param {(val: T) => boolean | Promise<boolean>} predicate - A function that returns a boolean (or a promise of boolean) indicating whether to keep the value.
   * @returns {FlowBox<T | Promise<T> | null>} A new FlowBox containing the value if the predicate passes, otherwise `null`.
   *
   * @example
   * const box = FlowBox.of(5);
   * const filtered = box.filter(x => x > 3).run(); // 5
   * const filteredFail = box.filter(x => x > 10).run(); // null
   *
   * // Works with async predicates
   * const asyncBox = FlowBox.thunk(async () => 5);
   * const filtered = await asyncBox.filter(async x => x > 3).run(); // Promise resolving to 5
   */
  filter(predicate: (val: T) => boolean | Promise<boolean>) {
    return this._thunkWithConfig(() => {
      return this._resolve(this.value, (v: any) => {
        const bool = predicate(v);
        if (isPromise(bool)) {
          return bool.then((res) => (!!res ? v : null));
        }
        return !!bool ? v : null;
      });
    });
  }

  /**
   * Passes a resolved value to a function that can return a FlowBox, and unboxes the resolved result. Unboxes only one layer deep.
   * If your function does not return a FlowBox, it will return the value instead.
   *
   * It allows chaining multiple FlowBox-producing operations in a single pipeline while propagating errors,
   * promises, and bad values automatically.
   *
   * @template U The type of the value contained in the returned FlowBox.
   * @param {(val: T) => FlowBox<U | Promise<U>> | Promise<U> | U} fn - A function that returns a FlowBox or a value/promise.
   * @returns {FlowBox<U | Promise<U>>} A new FlowBox containing the flattened result.
   *
   * @example
   * const box = FlowBox.of(5);
   * const result = box.flatMap(x => FlowBox.of(x + 1)).run(); // 6
   *
   * // Works with async FlowBoxes
   * const asyncBox = FlowBox.thunk(async () => 5);
   * const result = await asyncBox.flatMap(x => FlowBox.thunk(async () => x + 1)).run(); // Promise resolving to 6
   */
  flatMap<U = any>(fn: (v: T) => MaybeFlowBox<U>) {
    return this._thunkWithConfig(() => {
      return this._resolve(this.value, (v: T) =>
        this._resolve(fn(v), FlowBox._unbox)
      );
    });
  }

  /**
   * Flattens a nested FlowBox or a promise that resolves to a FlowBox.
   *
   * If the FlowBox contains another FlowBox (or a promise resolving to a FlowBox),
   * `flat` unwraps it so that the resulting FlowBox contains the inner value directly.
   *
   * @returns {FlowBox<Unbox<T>>} A new FlowBox with the inner value flattened.
   *
   * @example
   * const box = FlowBox.of(FlowBox.of(5));
   * const flatBox = box.flat().run(); // 5
   *
   * // Works with async FlowBoxes
   * const asyncBox = FlowBox.thunk(async () => FlowBox.of(5));
   * const flatBox = await asyncBox.flat().run(); // Promise resolving to 5
   */
  flat() {
    return this._thunkWithConfig(() => {
      return this._resolve(this.value, FlowBox._unbox);
    }) as any;
  }
  /**
   * Recursively flattens FlowBoxes or promises that resolve to FlowBoxes until a value is reached.
   * @returns {FlowBox<Unbox<T>>} A new FlowBox with the inner value recursively flattened.
   */
  flattenDeep() {
    return this._thunkWithConfig(() => {
      return this._resolve(this.value, FlowBox._unboxDeep);
    }) as any;
  }

  /**
   * Applies a resolved value that is a function to a value contained in another FlowBox's resolved value, or a plain resolved value..
   *
   * This is the applicative functor pattern. The first FlowBox should contain a function, which
   * will be applied to the value of the second FlowBox. Promises and bad values are handled automatically in either box.
   * If either resolved value is "bad", that resolved value will be returned. If the first box does not resolve to a function, that resolved value will be returned.
   *
   * @param {MaybePromise<FlowBox<any> | any>} fb - A FlowBox or value containing the argument to apply the function to.
   * @returns {FlowBox<MaybePromise<any>>} A new FlowBox containing the result of the function application.
   *
   * @example
   * const fnBox = FlowBox.of((x: number) => x + 1);
   * const valBox = FlowBox.of(2);
   * const result = fnBox.ap(valBox).run(); // 3
   *
   * // Works with promises
   * const asyncFnBox = FlowBox.thunk(async () => (x: number) => x + 1);
   * const asyncValBox = FlowBox.thunk(async () => 2);
   * const result = await asyncFnBox.ap(asyncValBox).run(); // Promise resolving to 3
   */
  ap<U = any, V = any>(fb: MaybeFlowBox<V>) {
    return this._thunkWithConfig(() => {
      return this._resolve(this.value, (faResolved: Function) => {
        if (!isFunction(faResolved)) return faResolved as U;
        return this._resolve(FlowBox._unbox(fb), faResolved);
      });
    });
  }

  /**
   * Iterates over a resolved collection of values, deeply unboxes them,
   * and calls the callback on each resolved value in the collection, then deeply unboxes those results.
   * Respects the original shape of the collection.
   * If the original resolved value is not a supported collection, it will be coerced into an array.
   *
   * @template U The type of values returned by the callback function.
   * @param {(val: any) => FlowBox<U> | Promise<U> | U} fn - A function to apply to each element of the collection.
   * @returns {FlowBox<MaybePromise<U[]>>} A FlowBox containing the collection of results.
   *
   * @note If your results are now an array of promises and you want them to resolve together, consider calling `toPromiseAll` or `toPromiseAllSettled`.
   *
   * @example
   * const box = FlowBox.of([1, 2, 3]);
   * const result = box.traverse(x => FlowBox.of(x + 1)).run(); // [2, 3, 4]
   *
   * Works with async callbacks
   * const asyncBox = FlowBox.of([1, 2, 3]);
   * const result = await asyncBox.traverse(async x => x + 1).run(); // An array of promises that will resolve to [2, 3, 4]
   *
   * Deeply unboxes nested FlowBoxes returned by the callback
   * const nestedBox = FlowBox.of([FlowBox.of(1), FlowBox.of(2)]);
   * const result = await nestedBox.traverse(x => FlowBox.of(x.run())).run(); // [1, 2]
   *
   * Respects original data structure
   * const mapBox = FlowBox.of(new Map([['1', 'bye'], ['2', 'no']]))
   * const result = mapBox.traverse(addExclamation).run()
   * Map([['1', 'bye!'], ['2', 'no!']])
   *
   */
  traverse(fn: any) {
    return this._thunkWithConfig(() => {
      const val = this.value;
      return [
        FlowBox._unboxDeep,
        (src: any) => ({ src, entries: toEntries(src) }),
        (cxt: any) => ({
          ...cxt,
          entries: cxt.entries.map(([k, v]: any) => [k, FlowBox._unboxDeep(v)]),
        }),
        (cxt: any) => {
          return {
            ...cxt,
            entries: cxt.entries.map(([k, v]: any) => [
              k,
              this._resolve(v, (v: any) => fn(v, k, cxt.src)),
            ]),
          };
        },
        (cxt: any) => ({
          ...cxt,
          entries: cxt.entries.map(([k, v]: any) => [k, FlowBox._unboxDeep(v)]),
        }),
        (cxt: any) => fromEntries(cxt.entries, cxt.src),
      ].reduce((v, func) => {
        return this._resolve(v, func);
      }, val);
    });
  }
  /**
   * alias for flatMap
   */
  chain(fn: any) {
    return this.flatMap(fn);
  }

  /**
   *
   * Iterates over a resolved collection of values, and deeply unboxes them.
   * Respects the original shape of the collection.
   * If the original resolved value is not a supported collection, it will be coerced into an array.

   *
   * @returns {FlowBox<MaybePromise<Unbox<T>[]>>} A FlowBox containing an array of resolved values.
   * @note If your results are now an array of promises and you want them to resolve together, consider calling `toPromiseAll` or `toPromiseAllSettled`.
   *
   * @example
   * const box = FlowBox.of([FlowBox.of(1), FlowBox.of(2), FlowBox.of(3)]);
   * const result = box.sequence().run(); // [1, 2, 3]
   *
   * const box = FlowBox.of(1);
   * const result = box.sequence().run(); // [1]
   *
   * // Works with async FlowBoxes
   * const asyncBox = FlowBox.of([FlowBox.thunk(async () => 1), FlowBox.thunk(async () => 2)]);
   * const result = await asyncBox.sequence().run(); // Array of promises resolving to [1, 2]
   */
  sequence() {
    return this._thunkWithConfig(() => {
      const val = this.value;
      return [
        (src: any) => ({ src, entries: toEntries(src) }),
        (cxt: any) => ({
          ...cxt,
          entries: cxt.entries.map(([k, v]) => [k, FlowBox._unboxDeep(v)]),
        }),
        (cxt: any) => fromEntries(cxt.entries, cxt.src),
      ].reduce((v, fn) => {
        return this._resolve(v, fn);
      }, val);
    });
  }

  /**
   * Iterates over a resolved collection of values, and packs those resolved values into a FlowBox if they are not already.
   * Respects the original shape of the collection.
   * If the original resolved value is not a supported collection, it will be coerced into an array.
   *
   * @returns {FlowBox<MaybePromise<FlowBox<Unbox<T>>[]>>} A FlowBox containing an array of FlowBoxes.
   *
   * @example
   * const box = FlowBox.of([1, 2, 3]);
   * const distributed = box.distribute().run(); // [FlowBox(1), FlowBox(2), FlowBox(3)]
   *
   * // Works with existing FlowBoxes in the collection
   * const nestedBox = FlowBox.of([FlowBox.of(1), 2]);
   * const distributed = nestedBox.distribute().run(); // [FlowBox(1), FlowBox(2)]
   *
   * const box = FlowBox.of(1);
   * const result = FlowBox.distribute().run() // [1];
   */
  distribute() {
    return this._thunkWithConfig(() => {
      const val = this.value;
      return [
        (src: any) => ({ src, entries: toEntries(src) }),
        (cxt: any) => ({
          ...cxt,
          entries: cxt.entries.map(([k, v]: any) => [
            k,
            FlowBox.isFlowBox(v) ? v : this._ofWithConfig(v),
          ]),
        }),
        (cxt: any) => fromEntries(cxt.entries, cxt.src),
      ].reduce((v, fn) => {
        return this._resolve(v, fn);
      }, val);
    });
  }

  // RUNNERS

  /**
   * Evaluates the FlowBox and returns its value.
   *
   * If the value is a promise, the promise is returned. If an error is thrown
   * during evaluation, the error is returned instead of being thrown.
   * If the promise rejects, the rejected value is returned.
   *
   * @returns {T | Promise<T> | unknown} The value contained in the FlowBox, a promise resolving to the value,
   * or an error if one occurred.
   *
   * @example
   * const box = FlowBox.of(5);
   * console.log(box.run()); // 5
   *
   * const asyncBox = FlowBox.thunk(async () => 5);
   * console.log(await asyncBox.run()); // 5
   */
  run() {
    try {
      const val = this.value;
      if (isPromise(val)) return val.catch(identity);
      return val;
    } catch (err) {
      return err;
    }
  }

  /**
   * Evaluates the FlowBox and returns its value.
   *
   * Unlike `run`, this will throw if the value is an error, letting you handle it
   * with traditional try/catch. Use this when you want the pipeline to fail fast on errors.
   * If the promise rejects, it is not caught.
   *
   * @returns {T} The value contained in the FlowBox.
   * @throws {unknown} Throws an error if the evaluated value is an error.
   *
   * @example
   * const box = FlowBox.of(5);
   * console.log(box.unwrap()); // 5
   *
   * const errorBox = FlowBox.of(new Error('fail'));
   * try {
   *   errorBox.unwrap();
   * } catch (err) {
   *   console.error(err); // Error: fail
   * }
   */
  unwrap() {
    const val = this.value;
    if (isError(val)) {
      throw val;
    }
    return val;
  }

  /**
   * Runs all parts of the pipeline before it, and puts the value in a FlowBox.
   *
   * This is useful for reintroducing a value (or error) back into a FlowBox
   * chain for further processing. If the evaluation throws, the error is captured
   * in a new FlowBox.
   *
   * @returns {FlowBox<T | Promise<T> | unknown>} A new FlowBox containing the evaluated value or error.
   *
   * @example
   * const box = FlowBox.of(5);
   * const collected = box.collect(); // FlowBox(5)
   * console.log(collected.run()); // 5
   *
   * const errorBox = FlowBox.thunk(() => { throw new Error('fail'); });
   * const collected = errorBox.collect();
   * console.log(collected.run()); // Error object
   */
  collect() {
    try {
      return this._ofWithConfig(this.value);
    } catch (err) {
      return this._ofWithConfig(err);
    }
  }

  /**
   * Provides a comprehensive fold over the FlowBox value, handling errors, "bad" values, and successful values separately.
   *
   * This is similar to a combination of `try/catch` and a `maybe`/`either` fold:
   * - `onError` handles thrown errors or rejected promises.
   * - `onNothing` handles "bad values" as defined in the FlowBox configuration.
   * - `onOk` handles successfully resolved values.
   * - `onFinally` is always executed after the fold completes, regardless of outcome.
   *
   * @template U The return type of the fold callbacks.
   * @param {(err: unknown) => U} onError - Callback invoked when the FlowBox value is an error or a promise rejects.
   * @param {(val: T) => U} onNothing - Callback invoked when the FlowBox value is considered "bad" (null, undefined, NaN, or custom predicates).
   * @param {(val: T) => U} onOk - Callback invoked when the FlowBox value is valid and not an error.
   * @param {() => void} [onFinally] - Optional callback executed after the fold completes and all potential promises resolve, regardless of outcome.
   * @returns {MaybePromise<U>} The result of the appropriate callback. If the FlowBox contained a promise, this may be a promise.
   *
   * @example
   * const box = FlowBox.of(5);
   * const result = box.fold(
   *   err => `Error: ${err}`,
   *   val => `Nothing: ${val}`,
   *   val => `Ok: ${val}`
   * );
   * console.log(result); // "Ok: 5"
   *
   * const badBox = FlowBox.of(null);
   * const result = badBox.fold(
   *   err => `Error: ${err}`,
   *   val => `Nothing: ${val}`,
   *   val => `Ok: ${val}`
   * );
   * console.log(result); // "Nothing: null"
   *
   * const errorBox = FlowBox.thunk(() => { throw new Error('fail'); });
   * const result = errorBox.fold(
   *   err => `Error: ${err.message}`,
   *   val => `Nothing: ${val}`,
   *   val => `Ok: ${val}`
   * );
   * console.log(result); // "Error: fail"
   *
   * // Async example
   * const asyncBox = FlowBox.thunk(async () => 42);
   * const result = await asyncBox.fold(
   *   err => `Error: ${err}`,
   *   val => `Nothing: ${val}`,
   *   val => `Ok: ${val}`
   * );
   * console.log(result); // "Ok: 42"
   */
  fold<U>(
    onError: (err: Error) => any,
    onNothing: (nothing: BadValue) => any,
    onOk: (v: T) => any,
    onFinally: () => void
  ) {
    let val: T | BadValue;
    try {
      val = this.value;
      if (isPromise(val)) {
        return val
          .then((v: T | BadValue) => {
            if (isError(v)) return onError(v);
            if (this._isBadValue(v)) return onNothing(v);
            return onOk(v);
          })
          .catch(onError)
          .finally(
            () =>
              [() => !!onFinally, () => isFunction(onFinally)].every(invoke) &&
              onFinally?.()
          );
      } else {
        if (isError(val)) return onError(val);
        if (this._isBadValue(val)) return onNothing(val);
        return onOk(val);
      }
    } catch (err) {
      return onError(err);
    } finally {
      [
        () => !!onFinally,
        () => isFunction(onFinally),
        () => !isPromise(val),
      ].every(invoke) && onFinally?.();
    }
  }

  // HELPERS AND ERROR HANDLING

  /**
   * Catches errors in the FlowBox, including thrown errors or rejected promises,
   * and allows recovery via a callback function.
   *
   * Similar to a try/catch for a FlowBox value.
   *
   * @param {(err: unknown) => T | Promise<T>} fn - A function that handles the error and returns a value or promise.
   * @returns {FlowBox<MaybePromise<T>>} A new FlowBox with either the original value or the result of the error handler.
   *
   * @example
   * const box = FlowBox.thunk(() => { throw new Error('fail'); });
   * const recovered = box.catch(err => 'recovered').run(); // "recovered"
   *
   * const asyncBox = FlowBox.thunk(async () => { throw new Error('fail'); });
   * const recovered = await asyncBox.catch(err => 'recovered').run(); // Promise resolving to "recovered"
   */
  catch(fn: any) {
    return this._thunkWithConfig(() => {
      try {
        const val = this.value;
        if (isPromise(val)) {
          return val.then((v) => (isError(v) ? fn(v) : v)).catch(fn);
        }
        return isError(val) ? fn(val) : val;
      } catch (err) {
        return fn(err);
      }
    });
  }

  /**
   * Recovers from "bad values" in the FlowBox according to the box's configuration.
   *
   * If the value is considered "bad" (null, undefined, NaN, Error, or custom predicate),
   * the provided function will be called with that value.
   *
   * @param {(val: T) => T | Promise<T>} fn - A function that receives the bad value and returns a replacement or promise.
   * @returns {FlowBox<MaybePromise<T>>} A new FlowBox with either the original value or the recovered value.
   *
   * @example
   * const box = FlowBox.of(null);
   * const recovered = box.recover(val => 'default').run(); // "default"
   *
   * const asyncBox = FlowBox.thunk(async () => null);
   * const recovered = await asyncBox.recover(val => 'default').run(); // Promise resolving to "default"
   */
  recover(fn: any) {
    return this._thunkWithConfig(() => {
      try {
        const val = this.value;
        if (isPromise(val)) {
          return val
            .then((res) => (this._isBadValue(res) ? fn(res) : res))
            .catch(fn);
        }
        if (this._isBadValue(val)) {
          return fn(val);
        }
        return val;
      } catch (err) {
        return fn(err);
      }
    });
  }

  /**
   * Converts a resolved collection of values into a single promise (via Promise.all) that, once resolved, will place all values back into the original shape of the collection by key.
   *
   * Useful when the FlowBox contains an array of values or FlowBoxes/promises, such as after a traverse.
   *
   * @returns {FlowBox<Promise<any[]>>} A FlowBox containing a promise resolving to an array of values.
   *
   * @example
   * const box = FlowBox.of([1, 2, 3]);
   * const result = await box.toPromiseAll().run(); // [1, 2, 3]
   *
   * const asyncBox = FlowBox.of([Promise.resolve(1), Promise.resolve(2)]);
   * const result = await asyncBox.toPromiseAll().run(); // [1, 2]
   */

  toResolvedAll() {
    return this._thunkWithConfig(() => {
      const val = this.value;
      return [
        (src: any) => ({ src, entries: toEntries(src) }),
        (cxt: any) => ({
          ...cxt,
          promises: Promise.all(cxt.entries.map(([_, v]) => v)),
        }),
        (cxt: any) => ({
          ...cxt,
          results: cxt.promises.then((res: any[]) =>
            res.map((r, i) => [head(cxt.entries[i]), r])
          ),
        }),
        (cxt: any) =>
          cxt.results.then((entries: any[]) => fromEntries(entries, cxt.src)),
      ].reduce((v, fn) => {
        return this._resolve(v, fn);
      }, val);
    });
  }

  /**
   * Converts a resolved collection of values into a single promise (via Promise.allSettled) that, once resolved, will place all values back into the original shape of the collection by key.
   *
   * Each element is wrapped in `{ status: "fulfilled" | "rejected", value | reason }`.
   *
   * @returns {FlowBox<Promise<PromiseSettledResult<any>[]>>} A FlowBox containing a promise resolving to an array of settled results.
   *
   * @example
   * const box = FlowBox.of([Promise.resolve(1), Promise.reject('fail')]);
   * const result = await box.toPromiseAllSettled().run(); // [{status: "fulfilled", value: 1}, {status: "rejected", reason: "fail"}]
   */
  toResolvedAllSettled() {
    return this._thunkWithConfig(() => {
      const val = this.value;
      return [
        (src: any) => ({ src, entries: toEntries(src) as any[] }),
        (cxt: any) => ({
          ...cxt,
          promises: Promise.allSettled(cxt.entries.map(([_, v]: any) => v)),
        }),
        (cxt: any) => ({
          ...cxt,
          results: cxt.promises.then((res: any[]) =>
            res.map((r, i) => [head(cxt.entries[i]), r])
          ),
        }),
        (cxt: any) =>
          cxt.results.then((entries: any[]) => fromEntries(entries, cxt.src)),
      ].reduce((v, fn) => {
        return this._resolve(v, fn);
      }, val);
    });
  }

  // Debugging

  /**
   * Logs the value for debugging purposes.
   *
   * Does not modify the value, just prints to the console.
   *
   * @param {string} [tag=''] - Optional label for the log.
   * @returns {FlowBox<T>} The same FlowBox instance for chaining.
   *
   * @example
   * const box = FlowBox.of(42);
   * box.inspect('Debug').run(); // Logs: FlowBox - Debug - 'Value - 42'
   */
  inspect(tag = '') {
    return this._thunkWithConfig<T>(() => {
      const val = this.value;
      const label = `FlowBox - ${tag ? `${tag} - ` : ''}'Value - '`;
      console.log(label, val);
      return val;
    });
  }

  /**
   * Executes a side-effecting function with the FlowBox itself.
   *
   * Useful for debugging, logging, or triggering actions without affecting the value.
   *
   * @param {(fb: FlowBox<T>) => void} fn - A function that receives the FlowBox instance.
   * @returns {FlowBox<T>} The same FlowBox instance for chaining.
   *
   * @example
   * const box = FlowBox.of(42);
   * box.tap(fb => console.log('Current value:', fb.run())).run();
   */
  tap(fn: any) {
    return this._thunkWithConfig<T>(() => {
      const val = this.value;
      try {
        fn(this);
      } catch (err) {}
      return val;
    });
  }

  /**
   * Executes a function with the FlowBox's value and configuration.
   *
   * Allows inspection of the value or config, often for debugging or logging purposes.
   *
   * @param {(val: T, config: FlowBoxConfig) => void} fn - Function that receives the value and config.
   * @returns {FlowBox<T>} The same FlowBox instance for chaining.
   *
   * @example
   * const box = FlowBox.of(42);
   * box.peek((val, config) => console.log('Value:', val, 'Config:', config)).run(); // logs 'Value: 42', 'Config: config'
   */
  peek(fn: (val: any, config: FlowBoxConfig) => void) {
    return this._thunkWithConfig<T>(() => {
      const val = this.value;
      try {
        fn(val, this.config);
        return val;
      } catch (err) {}
      return val;
    });
  }
}

export default FlowBox;
