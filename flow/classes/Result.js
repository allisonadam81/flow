class Result {
  static Ok = (v) => new Ok(v);
  static Err = (e) => new Err(e);
}

export class Ok {
  constructor(v) {
    this.v = v;
  }
  map = (fn) => Result.Ok(fn(this.v));
  tap = (fn) => {
    fn(this.v);
    return this;
  };
  sequence = () => {
    return Result.Ok(
      this.v.map((item) => {
        if (item instanceof Ok || item instanceof Err) return item;
        return Result.Ok(item);
      })
    );
  };
  flatMap = (fn) => fn(this.v);
  flat = () => {
    return Result.Ok(
      this.v.map((res) => {
        if (!(res instanceof Ok || res instanceof Err)) return res;
        return res.fold(
          (e) => e,
          (v) => v
        );
      })
    );
  };
  fold = (onError, onOk) => onOk(this.v);
  inspect = (label) => {
    const lbl = label ?? 'Ok log --> ';
    console.log(lbl, this.v);
    return this;
  };
}

export class Err {
  constructor(e) {
    this.e = e;
  }
  map = () => this;
  flatMap = () => this;
  tap = () => this;
  flat = () => this;
  fold = (onError, onOk) => onError(this.e);
  inspect = (label) => {
    const lbl = label ?? 'Err log --> ';
    console.log(lbl, this.e);
    return this;
  };
}

export const tryResult = (fn) => {
  return (...args) => {
    try {
      return Result.Ok(fn(...args));
    } catch (e) {
      return Result.Err(e);
    }
  };
};

export default Result;
