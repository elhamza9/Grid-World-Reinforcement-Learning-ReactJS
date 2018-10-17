
export const randomizePolicy = (allowed_moves_map) => {
    //alert('randomize policy');
    let new_policy = new Map(), moves, rand_pos;
    for (let s of allowed_moves_map.keys()) {
        moves = allowed_moves_map.get(s);
        if (moves.length > 0) {
            rand_pos = Math.floor(moves.length * Math.random());
            new_policy.set(s, moves[rand_pos]);
        }
    }
    return new_policy;
};

export const clearPolicy = (states) => {
    let policy = new Map();
    for (let s of states) {
        policy.set(s, '');
    }
    return policy;
};

export const editSingleStatePolicy = (policy, allowed_moves, state_to_change, new_action) => {
    let newPol = new Map(policy);
    if (allowed_moves.get(state_to_change).includes(new_action)) {
        newPol.set(state_to_change, new_action);
    }
    return newPol;
}

export const setStatesTransitionsToUniform = (states_transitions_map, allowed_moves_map) => {
    let new_states_transitions_map = new Map();
    let nbr_possible_actions, pr, st, new_st, moves;
    for (let s of states_transitions_map.keys()) {
        st = states_transitions_map.get(s);
        moves = allowed_moves_map.get(s);
        nbr_possible_actions = moves.length;
        if (nbr_possible_actions > 0) {
            pr = 1/nbr_possible_actions;
            new_st = [];
            for (let e of st) {
                if (moves.includes(e[0])) {
                    new_st.push([e[0], pr]);
                } else {
                    new_st.push([e[0], 0]);
                }
            }
            new_states_transitions_map.set(s, new_st);
        } else {
            new_states_transitions_map.set(s, []);
        }
    }
    return new_states_transitions_map;
};

export const setStatesTransitionsToWindy = (states_transitions_map, policy) => {
    let new_map = new Map(states_transitions_map);
    let st;
    for (let s of new_map.keys(s)) {
        st = new_map.get(s);
        for (let e of st) {
            if (e[0] === policy.get(s)) {
                e[1] = 0.5;
            } else {
                e[1] = 0.5/3;
            }
        }
    }
    return new_map;
};

export const setStatesTransitionsToDeterministic = (states_transitions_map) => {
    let new_map = new Map(states_transitions_map);
    for (let st of new_map.values()) {
        for (let e of st) {
            e[1] = 1;
        }
    }
    return new_map;
}