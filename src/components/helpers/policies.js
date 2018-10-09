
export const randomizePolicies = (policies_map, prob_main_action, prob_other_actions) => {
    let new_policies_map = new Map(policies_map), p, rand_pos;
    for (let s of new_policies_map.keys()) {
        p = new_policies_map.get(s);
        if (p.length > 0) {
            for (let e of p) {
                e[1] = prob_other_actions;
            }
            rand_pos = Math.floor(Math.random() * p.length);
            p[rand_pos][1] = prob_main_action;
        }
    }
    return new_policies_map;
}   