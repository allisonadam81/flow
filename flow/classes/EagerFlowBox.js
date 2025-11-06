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
    const label = `FlowBox - ${tag ? `${tag} - ` : ''}${this.isError ? 'Error - ' : 'Value - '}`;
    console.log(label, this._value);
    return this;
  }

  tap(fn) {
    if (this.isError || this.isNothing) return this;
    try {
      fn(this);
      return this;
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  map(fn) {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      if (isPromise(val)) {
        return FlowBox.of(val.then(fn));
      }
      return FlowBox.of(fn(val));
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  flatMap(fn) {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      if (isPromise(val)) {
        return FlowBox.of(
          val.then(fn).then((res) => (FlowBox.isFlowBox(res) ? res.value : res))
        );
      }
      return fn(val);
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  filter(predicate) {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      if (isPromise(val)) {
        return FlowBox.of(val.then((res) => (predicate(res) ? res : null)));
      }
      return predicate(val) ? FlowBox.of(val) : FlowBox.of(null);
    } catch (err) {
      return FlowBox.error(err);
    }
  }
  chain(fn) {
    return this.flatMap(fn);
  }

  sequence() {
    if (this.isError || this.isNothing) return this;
    try {
      return FlowBox.of(
        toArray(this.value).map((v) => (FlowBox.isFlowBox(v) ? v.run() : v))
      );
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  distribute() {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      return FlowBox.of(
        toArray(val).map((v) => (FlowBox.isFlowBox(v) ? v : FlowBox.of(v)))
      );
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  flat() {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      if (FlowBox.isFlowBox(val)) return val;
      if (isPromise(val)) {
        return FlowBox.of(
          val.then((v) => (FlowBox.isFlowBox(v) ? v.value : v))
        );
      }
      return FlowBox.of(val);
    } catch (err) {
      return FlowBox.error(err);
    }
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
          .finally(() => {
            onFinally && onFinally();
          });
      } else {
        if (this.isError) return onError(val);
        if (this.isNothing) return onNothing(val);
        return onOk(val);
      }
    } catch (err) {
      onError(err);
    } finally {
      if (onFinally && !isPromise(val)) {
        onFinally();
      }
    }
  }
}

export const EagerFlowBox = FlowBox
