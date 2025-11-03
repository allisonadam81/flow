class SmartBox {
  constructor(value, isError = false) {
    this._value = value;
    this._isError = isError;
  }
  static of(val) {
    return new SmartBox(val);
  }
  static error(err) {
    return new SmartBox(err, true);
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

  get isSmartBox() {
    return this._value instanceof SmartBox;
  }

  get() {
    return this.value;
  }

  inspect(tag = '') {
    const label = `SmartBox - ${tag ? `${tag} - ` : ''}${this.isError ? 'Error - ' : 'Value - '}`;
    console.log(label, this._value);
    return this;
  }

  tap(fn) {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      fn(val);
      return SmartBox.of(val);
    } catch (err) {
      return SmartBox.error(err);
    }
  }

  map(fn) {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      if (val instanceof Promise) {
        return SmartBox.of(val.then(fn));
      }
      return SmartBox.of(fn(val));
    } catch (err) {
      return SmartBox.error(err);
    }
  }
  flatMap(fn) {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      if (val instanceof Promise) {
        return SmartBox.of(val.then(fn).then((res) => res.value));
      }
      return fn(val);
    } catch (err) {
      return SmartBox.error(err);
    }
  }

  flat() {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      if (val instanceof SmartBox) return val;
      if (val instanceof Promise) {
        return SmartBox.of(
          val.then((v) => (v instanceof SmartBox ? v.value : v))
        );
      }
      return SmartBox.of(val);
    } catch (err) {
      SmartBox.error(err);
    }
  }

  fold(onError, onNothing, onOk) {
    try {
      const val = this.value;
      if (val instanceof Promise) {
        return val
          .then((v) => {
            if (this.isError) return onError(v);
            if (this.isNothing) return onNothing(v);
            return onOk(v);
          })
          .catch(onError);
      } else {
        if (this.isError) return onError(val);
        if (this.isNothing) return onNothing(val);
        return onOk(val);
      }
    } catch (err) {
      onError(err);
    }
  }
}

const sleep = (time) => {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};

const mine = SmartBox.of(() => {
  // await sleep(500);
  return 1;
});

mine
  .map((x) => x + 1)
  .inspect()
  .map((x) => {
    x.something();
    return x;
  })
  .fold(
    (e) => {
      console.log('error caught by fold', e);
    },
    (n) => n,
    (ok) => {
      console.log('ok from fold', ok);
    }
  );
