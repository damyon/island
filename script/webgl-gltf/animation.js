const activeAnimations = {};
const getAnimationFromLast = (track, key, offset = 0) => {
    if (activeAnimations[track] === undefined || activeAnimations[track][key] === undefined || activeAnimations[track][key].length - offset - 1 < 0) {
        return null;
    }
    return activeAnimations[track][key][activeAnimations[track][key].length - offset - 1];
};
/**
 * Sets the active animation
 * @param track Animation track
 * @param key Animation set key
 * @param model GLTF Model
 * @param animation Animation key
 */
const pushAnimation = (track, key, model, animation) => {
    var _a;
    const k = `${key}_${model}`;
    if (!activeAnimations[track])
        activeAnimations[track] = [];
    if (!activeAnimations[track][k])
        activeAnimations[track][k] = [];
    if (((_a = getAnimationFromLast(track, k)) === null || _a === void 0 ? void 0 : _a.key) === animation)
        return;
    activeAnimations[track][k].push({
        key: animation,
        elapsed: 0,
    });
    activeAnimations[track][k].slice(activeAnimations[track][k].length - 2);
};
/**
 * Gets the current and previous animation
 * @param key Animation set key
 * @param model GLTF Model
 */
const getActiveAnimations = (key, model) => {
    const k = `${key}_${model}`;
    const aa = {};
    if (Object.keys(activeAnimations).length === 0)
        return null;
    Object.keys(activeAnimations).forEach(c => {
        if (!activeAnimations[c][k])
            return;
        aa[c] = activeAnimations[c][k].slice(activeAnimations[c][k].length - 2);
    });
    return aa;
};
/**
 * Advances the animation
 * @param elapsed Time elasped since last update
 * @param key Animation set key
 */
const advanceAnimation = (elapsed, key) => {
    Object.keys(activeAnimations).forEach(c => {
        Object.keys(activeAnimations[c]).forEach(m => {
            if (key && m.indexOf(key) !== 0)
                return;
            const current = getAnimationFromLast(c, m);
            const previous = getAnimationFromLast(c, m, 1);
            if (current)
                current.elapsed += elapsed;
            if (previous)
                previous.elapsed += elapsed;
        });
    });
};
