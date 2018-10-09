

export const setRewards = (rewardsMap, goalState, goalReward, holeState, holeReward, wallStates, stepCost) => {
    let newRewardsMap = new Map(rewardsMap);

    for (let s of rewardsMap.keys()) {
        if (s === goalState) {
          newRewardsMap.set(s, goalReward);
        } else if (s === holeState) {
          newRewardsMap.set(s, holeReward);
        } else if ( s in wallStates) {
          newRewardsMap.set(s, 0)
        } else {
          newRewardsMap.set(s, stepCost)
        }
    }
    return newRewardsMap;
};