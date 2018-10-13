
const initState = {
    last_action_title: 'DO SOMETHING',
    data: null, // usually either 2D array, or string for arithmetic 
    type: 'string', // usually either 2D array, or string for arithmetic 
    level: 0, 
    reset: false,
};

const appReducer = (state=initState, action) => {

    switch(action.type) {

        case 'RESET_ACTION':
            return {
                last_action_title: null,
                data: null,
                type: null,
                level: 0,
                reset: true,
            };

        case 'ADD_ACTION':
            return {
                ...state,
                last_action_title: action.payload.actionTitle,
                data: action.payload.data,
                type: action.payload.type,
                level: action.payload.level,
                reset: false,
            };

        default:
            return state;

    }

};

export default appReducer;