const symptomsByUser = new Map();

export function addSymptom(userKey, symptomEntry) {
    if (!symptomsByUser.hasKey(userKey)) {
        symptomsByUser.set(userKey, []);
    }
    symptomsByUser.get(userKey).push(symptomEntry);
    return symptomEntry;
}

export function getSymptoms(userKey) {
    return symptomsByUser.get(userKey) || [];
}
