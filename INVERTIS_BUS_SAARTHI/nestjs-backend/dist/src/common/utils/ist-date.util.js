"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getISTMidnightUTC = getISTMidnightUTC;
function getISTMidnightUTC() {
    const now = new Date();
    const utcOffset = now.getTimezoneOffset() * 60000;
    const utcTime = now.getTime() + utcOffset;
    const istTime = new Date(utcTime + (330 * 60000));
    istTime.setHours(0, 0, 0, 0);
    return new Date(istTime.getTime() - (330 * 60000));
}
//# sourceMappingURL=ist-date.util.js.map