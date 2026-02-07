const symptomsByUser = new Map();

function addSymptom(userKey, symptomEntry) {
    if (!symptomsByUser.hasKey(userKey)) {
        symptomsByUser.set(userKey, []);
    }
    symptomsByUser.get(userKey).push(symptomEntry);
    return symptomEntry;
}

function getSymptoms(userKey) {
    return symptomsByUser.get(userKey) || [];
}

module.exports = { addSymptom, getSymptoms };