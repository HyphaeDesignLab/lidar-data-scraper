const areaLeavesOnOff = function (dateStart, dateEnd) {
    if (String(dateStart).length < 8 || String(dateEnd).length < 8) {
        return false;
    }
    const parts = {
        yearStart: String(dateStart).substring(0, 4),
        monthStart: String(dateStart).substring(4, 8),
        yearEnd: String(dateEnd).substring(0, 4),
        monthEnd: String(dateEnd).substring(4, 8)
    }
    if (!Object.keys(parts).every(k => {
        if (parts[k]) {
            parts[k] = parseInt(parts[k]);
            if (isNaN(parts[k])) {
                return false;
            }
        } else {
            return false;
        }
        return true;
    })) return false;

    const {yearStart, yearEnd, monthStart, monthEnd } = parts;

    if (yearStart === yearEnd) {
        // print('same year')
        if (monthStart >= 501 && monthEnd <= 930) {
            return 'on'
        } else if (monthEnd <= 331 || monthStart >= 1101) {
            return 'off'
        } else {
            return 'mixed'
        }
    } else if (yearEnd - yearStart === 1) {
        // print('1 year diff')
        if (monthStart >= 1101 && monthEnd <= 331) {
            return 'off'
        } else {
            return 'mixed'
        }
    } else {
        return 'mixed'
    }
}

module.exports = {areaLeavesOnOff};