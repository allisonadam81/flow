class Result {
  static Ok = (v) => new Ok(v);
  static Err = (e) => new Err(e);
}

class Ok {
  constructor(v) {
    this.v = v;
  }
  map = (fn) => Result.Ok(fn(this.v));
  tap = (fn) => {
    fn(this.v);
    return this;
  };
  flatMap = (fn) => fn(this.v);
  fold = (onError, onOk) => onOk(this.v);
  inspect = (label) => {
    const lbl = label ?? "Ok log --> ";
    console.log(lbl, this.v);
    return this;
  };
}

class Err {
  constructor(e) {
    this.e = e;
  }
  map = () => this;
  flatMap = () => this;
  tap = () => this;
  fold = (onError, onOk) => onError(this.e);
  inspect = (label) => {
    const lbl = label ?? "Err log --> ";
    console.log(lbl, this.e);
    return this;
  };
}

export const tryResult = (fn) => {
  try {
    return Result.Ok(fn());
  } catch (e) {
    return Result.Err(e);
  }
};

export default Result;
