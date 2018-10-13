

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

export const randomizeValues = (values_map, zero_states) => {
    console.log(zero_states);
    let newVals = new Map(values_map);
    for (let s of newVals.keys()) {
        if (zero_states.includes(s)) {
            newVals.set(s, 0);
        } else {
            newVals.set(s, Math.random());
        }
    }
    return newVals;
}

