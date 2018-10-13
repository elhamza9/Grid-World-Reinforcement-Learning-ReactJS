
import {getStateFromPos} from './general';

export const bellman_loop_actions = (pos_of_state, state_transitions, move_function, gamma, rewards_map, values_map, log_func) => {
    let new_val = 0;
    let a, pr_trans;
    console.log('       loop:');
    for (let e of state_transitions) {
        a = e[0];
        pr_trans = e[1];
        new_val += bellman_single_action (pos_of_state, a, pr_trans, move_function, gamma, rewards_map, values_map, log_func);
        /*new_state = move_function(a, false, pos_of_state);
        if (new_state.length === 2) {
            r_new_state = rewards_map.get(new_state);
            val_new_state = values_map.get(new_state);
            new_val += pr_trans * ( r_new_state + gamma*val_new_state );
        }*/
    }
    log_func('', `Total = ${new_val}`, 'string', 2);
    return new_val
};

export const bellman_single_action = (pos_of_state, a, pr_trans, move_function, gamma, rewards_map, values_map, log_func) => {
    let new_val;
    let new_state, r_new_state, val_new_state;
    new_state = move_function(a, false, pos_of_state);
    
    if (new_state !== null) {
        if (new_state === '') {
            new_state = getStateFromPos(pos_of_state[0], pos_of_state[1]);
        }
        r_new_state = rewards_map.get(new_state);
        val_new_state = values_map.get(new_state);
        new_val = pr_trans * ( r_new_state + gamma*val_new_state );
        console.log(`       new_val (${a}) = ${pr_trans} * ( ${r_new_state} + ${gamma}*${val_new_state} ) ==> ${new_val}`);
        log_func('', `new_val (${a}) = ${pr_trans} * ( ${r_new_state} + ${gamma}*${val_new_state} ) ==> ${new_val.toFixed(2)}`, 'string', 2);
        return new_val;
    } else {
        console.log(`Couldnt move from state ${pos_of_state} with action ${a}`);
        log_func('', `Couldnt move from state ${pos_of_state} with action ${a}`, 'string', 2);
    }
};
