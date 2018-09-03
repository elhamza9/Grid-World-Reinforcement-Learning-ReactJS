
export const setCurrentPositionAction = (i,j) => ({
    type: 'SET_CURRENT_POS_ACTION',
    payload: {i: i, j: j}
});


export const initValueFunctionAction = (states) => ({
    type: 'INIT_STATE_VALUES_ACTION',
    payload: {states: states}
});

export const setModeAction = (mode) => ({
    type: 'SET_MODE_ACTION',
    payload: {mode: mode}
})