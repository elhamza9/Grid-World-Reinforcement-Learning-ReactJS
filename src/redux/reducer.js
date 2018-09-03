
const initState = {
    mode: 'values', // show agent / show values of states / show possible moves
    currentI: 0,
    currentJ: 0,
    values: new Map()
}

const appReducer = (state=initState, action) => {
    switch(action.type) {

        case 'INIT_STATE_VALUES_ACTION':
            let newVals = new Map();
            for (let s of action.payload.states) {
                newVals.set(s, 0);
            }
            return {
                ...state,
                values: newVals,
            }

        case 'SET_CURRENT_POS_ACTION':
            return {
                ...state,
                currentI: action.payload.i,
                currentJ: action.payload.j,
            }

        case 'SET_MODE_ACTION':
            return {
                ...state,
                mode: action.payload.mode
            }

        default:
            return state;
    }
};

export default appReducer;