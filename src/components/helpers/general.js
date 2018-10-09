

export const getStateFromPos = (i, j) => {
    return i.toString().concat(j.toString());
};

export const getPosFromState = (s) => {
    if (typeof(s) === 'string' && s.length === 2) {
      return [parseInt(s[0], 10), parseInt(s[1], 10)];
    } else {
      return [];
    }
};

export const initValuesToZero = (valuesMap) => {
    let newVals = new Map(valuesMap);
    for (let s of newVals.keys()) {
      newVals.set(s, 0.0);
    }
    return newVals;
};

