import { toArray } from '../functions/to/toArray.js';
import { isPromise } from '../functions/is/isPromise.js';
import { rethrow } from '../functions/misc/rethrow.js';

class FlowBox {
  constructor(value, isError = false) {
    this._value = value;
    this._isError = isError;
  }

  static of(val) {
    return new FlowBox(val);
  }
  static error(err) {
    return new FlowBox(err, true);
  }
  static isFlowBox(v) {
    return v instanceof FlowBox;
  }

  get isError() {
    return !!this._isError;
  }
  get isNothing() {
    return this._value === null || this._value === undefined;
  }

  get value() {
    return typeof this._value === 'function' ? this._value() : this._value;
  }

  setIsError(bool) {
    this._isError = !!bool;
    return this;
  }
  setValue(v) {
    this._value = v;
    return this;
  }

  setAndRethrow(err) {
    this.setIsError(true);
    this.setValue(err);
    rethrow(err);
    return this;
  }

  run() {
    try {
      return this.value;
    } catch (err) {
      return err;
    }
  }

  inspect(tag = '') {
    return FlowBox.of(() => {
      const label = `FlowBox - ${tag ? `${tag} - ` : ''}${this.isError ? 'Error - ' : 'Value - '}`;
      console.log(label, this);
      return this.value;
    });
  }

  tap(fn) {
    return FlowBox.of(() => {
      fn(this);
      return this.value;
    });
  }

  map(fn) {
    if (this.isError || this.isNothing) return this;
    return FlowBox.of(() => {
      try {
        const val = this.value;
        if (val instanceof Promise) {
          return val.then(fn).catch(this.setAndRethrow);
        }
        return fn(val);
      } catch (err) {
        this.setAndRethrow(err);
      }
    });
  }

  flatMap(fn) {
    if (this.isError || this.isNothing) return this;
    return FlowBox.of(() => {
      try {
        const val = this.value;
        if (val instanceof Promise) {
          return FlowBox.of(
            val
              .then(fn)
              .then((res) => (FlowBox.isFlowBox(res) ? res.value : res))
              .catch(this.setAndRethrow)
          );
        }
        const res = fn(val);
        return FlowBox.isFlowBox(res) ? res.value : res;
      } catch (err) {
        this.setAndRethrow(err);
      }
    });
  }

  filter(predicate) {
    if (this.isError || this.isNothing) return this;
    return FlowBox.of(() => {
      try {
        const val = this.value;
        if (isPromise(val)) {
          return val
            .then((res) => (predicate(res) ? res : null))
            .catch(this.setAndRethrow);
        }
        return predicate(val) ? val : null;
      } catch (err) {
        this.setAndRethrow(err);
      }
    });
  }
  chain(fn) {
    return this.flatMap(fn);
  }
  // takes a list of values, turns it into an array, and then unpacks any internal flow boxes in that array.
  // FlowBox.of([FlowBox(1), FlowBox(2), FlowBox(3)]) turns into ->
  // FlowBox.of([1, 2, 3])
  sequence() {
    if (this.isError || this.isNothing) return this;
    return FlowBox.of(() => {
      try {
        return toArray(this.value).map((v) =>
          FlowBox.isFlowBox(v) ? v.value : v
        );
      } catch (err) {
        this.setAndRethrow(err);
      }
    });
  }

  // takes a raw value in a flow box, turns it into an array, and converts all internal elements into a flow box.
  // FlowBox.of([1, 2, 3]) turns into ->
  // FlowBox.of([FlowBox(1), FlowBox(2), FlowBox(3)])
  distribute() {
    if (this.isError || this.isNothing) return this;
    return FlowBox.of(() => {
      try {
        const val = this.value;
        return toArray(val).map((v) =>
          FlowBox.isFlowBox(v) ? v : FlowBox.of(v)
        );
      } catch (err) {
        this.setAndRethrow(err);
      }
    });
  }

  // unpacks a nested Flow Box.
  flat() {
    if (this.isError || this.isNothing) return this;

    return FlowBox.of(() => {
      try {
        const val = this.value;
        if (FlowBox.isFlowBox(val)) return val.value;
        if (isPromise(val)) {
          return val.then((v) =>
            (FlowBox.isFlowBox(v) ? v.value : v).catch(this.setAndRethrow)
          );
        }
        return val;
      } catch (err) {
        this.setAndRethrow(err);
      }
    });
  }

  fold(onError, onNothing, onOk, onFinally) {
    let val;
    try {
      val = this.value;
      if (isPromise(val)) {
        return val
          .then((v) => {
            if (this.isError) return onError(v);
            if (this.isNothing) return onNothing(v);
            return onOk(v);
          })
          .catch(onError)
          .finally(() => onFinally && onFinally());
      } else {
        if (this.isError) return onError(val);
        if (this.isNothing) return onNothing(val);
        return onOk(val);
      }
    } catch (err) {
      return onError(err);
    } finally {
      if (onFinally && !isPromise(val)) {
        onFinally();
      }
    }
  }
}

export const LazyFlowBox = FlowBox;
