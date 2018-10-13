
export const resetAction = () => ({
    type: 'RESET_ACTION',
    payload: {}
});

export const addAction = (action_title, data, type, level) => ({
    type: 'ADD_ACTION',
    payload: {actionTitle: action_title, data: data, type: type, level: level}
});