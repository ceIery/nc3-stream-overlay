const delay = async time => new Promise(resolve => setTimeout(resolve, time));

const opposite_team = color => color === 'red' ? 'blue' : 'red';

const mods_const = {
    "NM": 0,
    "EZ": 2,
    "HR": 16,
    "DT": 64,
    "HT": 256,
    "FL": 1024,
}

const calculate_mod_enum = mods => {
    let sum = 0;
    for (let i = 0; i < mods.length; i += 2) {
        const mod = mods.substring(i, i + 2);
        sum += mods_const[mod] || 0;
    }
    return sum;
}